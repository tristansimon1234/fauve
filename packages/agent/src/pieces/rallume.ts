import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « La pièce qui se rallume », the effect (docs/fiches/rallume.md, effects 1 to 4; its whole Reel is skills/rallume.ts,
// Tristan's own idea written as a design): laid on one wide shot of her place seen from inside, the room goes dark at
// once (its light dosed on what the shot shows, cooler); what it has several of (her lamps, her bottles, her cups, her
// plants: named by its filler, up to four kinds, « every … » for each one of them) lights up again one piece after the
// other, faster and faster on the beat, each at its own light seen through a soft oval, a bloom of its own highlights
// and a warm pool spilling from it, a soft click on each; then the whole room at once on a beat, as a breaker thrown
// (two images brighter, a warm veil, a heavier click), and her name lights up like a sign in the calm part of her room
// (a neon that catches: off, on, almost off, on, half, on), a small line in spaced capitals under it; both stay lit to
// the cut, and the montage takes over.
// Kept from its skill: its four kinds and their filler's words, its steps (beats 0, 1, 1,5, 2, 2,5, 2,75, 3 and 3,25 of
// a four-beat dark, all at once on the fourth), pieces that touch lit together, few pieces filled by the room's own
// light coming back a notch on each step left (with a flicker), its soft ovals, blooms, pools, breaker and neon, its
// name's sizes and its colour setting, its clicks. Its dark takes whole beats, about half its shot as in its skill (four
// beats dark, then four lit: 2,5 s each at 96 BPM), its steps scaled with it, and always leaves her name lit long enough
// to read.
// Added for an effect laid on any Reel: its dark dosed on the shot's own light (LightUnder: a white room in daylight
// needs a darker dose than a bar at night), and, when none of her things were found (none named, the card
// unavailable), her lights read on the room's light: its small spots much brighter than the ring around them (a lamp, a
// bulb, a window lit at night; never a white ceiling or wall, larger), the upper part of the room first, lit one by one
// the same way but seen through a wider oval whose light falls off from its middle (no cut-out: the room around it shows,
// never as a disc) and with half the bloom (a white cloth in it must not glow like a bulb), kept on their place
// as the camera moves (the calm area chosen once for her name, read where the camera has taken it); the light's grid is
// coarse (64 cells along the video's long side), so a bright cloth may pass for a lamp there. Without a reading either,
// the room comes back notch by notch, then all at once.
// Left out: its 16:9 frame on black (an effect plays in the Reel's own frame, full frame), the life of her place, its
// lights going off at the end and its ending card, its music muffled while the room is dark (an effect's timeline has
// no music shape), and its grain and corners left off (its Reel's finish).

/** Its lights' steps, in beats of a four-beat dark (faster and faster), and the whole room on its fourth. */
const STEPS = [0, 1, 1.5, 2, 2.5, 2.75, 3, 3.25];
const ALL_BEATS = 4;
/**
 * Its dark, in whole beats (two bars, a bar, half a bar, a beat: its steps stay on even fractions of the beat), the
 * nearest to half its room shot as its skill's (four beats dark, four lit), between 1,5 and 3,5 s, 4 s at most.
 */
const DARK_BEATS = [8, 4, 2, 1];
const DARK_SHARE = 0.5;
const DARK_LEAST = 1.5;
const DARK_TARGET_MOST = 3.5;
const DARK_MOST = 4;
/** Her name is whole from this image after the room comes on (its tube catching: off, on, almost off, on). */
const NAME_WHOLE = 3;
/** A soft click on each light, a heavier one when the whole room comes on. */
const CLICK = { sound: "light switch click", seconds: 0.5 };
const CLUNK = { sound: "heavy light switch clunk", seconds: 0.5 };

/** How long a line must stay whole to be read (the scene check's: 0,8 s plus 0,3 s a word, between 1,2 and 4,5 s), 0 without words. */
function readSeconds(text: string | undefined): number {
  const words = (text ?? "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return words ? Math.min(4.5, Math.max(1.2, 0.8 + 0.3 * words)) : 0;
}

/**
 * Its marks over a span: its eight steps and the whole room (frames from its start, on the Reel's beats), within its
 * room shot (its first shot, to its cut), leaving her name lit long enough to read; a click on each step, a clunk on
 * the room.
 */
export function rallumeTimeline({ frames, bpm, shots, words }: PieceTimelineInput): PieceTimeline {
  const beat = (60 / bpm) * REEL_FPS;
  const first = shots[0];
  const end = Math.max(1, Math.min(frames, first ? first.from + first.frames : frames));
  // Her name caught, then read whole; two beats at least, a second and a half.
  const lit = Math.max(2 * beat, 1.5 * REEL_FPS, NAME_WHOLE + readSeconds(words.nom) * REEL_FPS);
  // Its dark: the whole beats nearest to half its room shot that leave her name its time (the longer on a tie); else
  // what is left, half a beat at least.
  const target = Math.min(DARK_TARGET_MOST * REEL_FPS, Math.max(DARK_LEAST * REEL_FPS, DARK_SHARE * end));
  const near = [...DARK_BEATS].sort((a, b) => Math.abs(a * beat - target) - Math.abs(b * beat - target) || b - a);
  const fits = near.find((d) => d * beat <= end - lit && d * beat <= DARK_MOST * REEL_FPS);
  const dark = fits ? fits * beat : Math.max(beat / 2, Math.min(beat, end - lit));
  const all = Math.max(1, Math.round(dark));
  const steps = STEPS.map((s) => Math.round((s / ALL_BEATS) * dark));
  const at = (f: number) => Math.round((f / REEL_FPS) * 1000) / 1000;
  return {
    marks: { ...Object.fromEntries(steps.map((f, k) => [`step_${k}`, f])), all },
    sounds: [...steps.map((f, k) => ({ at: at(f), ...CLICK, gain: k ? -3 : -1 })), { at: at(all), ...CLUNK, gain: 3 }],
  };
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its room: the first of her shots playing during it. Past its cut, nothing: the montage plays on.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const room = mine[0];
  const END = Math.min(durationInFrames, shots[room].from + shots[room].durationInFrames);
  if (frame >= END) return null;
  // Its marks (frames from its start): its steps faster and faster, the whole room on a beat; without them, the same
  // on the beat it is given, her name still lit two seconds.
  const BEAT = mark("beat", 18) > 0 ? mark("beat", 18) : 18;
  const ALL = Math.max(1, Math.round(mark("all", Math.max(BEAT / 2, Math.min(4 * BEAT, END - 60)))));
  const STEPS = [0, 1, 1.5, 2, 2.5, 2.75, 3, 3.25].map((b, k) => mark("step_" + k, Math.round((b * ALL) / 4))).filter((f) => f < ALL);
  const laid = { left: 0, top: 0, width, height };
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const since = frame - ALL;
  const dark = frame < ALL;
  // While the room is dark and its pools fade, what lights it; then only her name over the room as filmed.
  const busy = frame < ALL + 10;
  const REF = Math.max(0, ALL - 1);

  // Her name's place: the calm part of her room (its ceiling, a wall, the upper part first), chosen once for the shot.
  const hook = word("nom");
  const small = word("ligne");
  const keep = (x) => String(x || "").replace(/(\d) (?=\d)/g, "$1 ");
  const chars = Array.from(keep(hook)).length;
  const NS = Math.min(150, Math.round(3200 / Math.max(8, chars)));
  const NH = Math.round(NS * 1.3);
  const LS = 40;
  const LH = small ? Math.round(LS * 1.9) : 0;
  const NW = 800;
  const CALM = { aspect: NW / (NH + LH), min: { w: Math.round(NW * 0.65), h: Math.round((NH + LH) * 0.65) }, max: { w: NW, h: NH + LH }, prefer: "top", fallback: { x: 140, y: Math.round(height * 0.15), w: NW, h: NH + LH } };
  const spot = ClearBox(shots[room], ALL + 2, laid, CALM) || CALM.fallback;
  // That same area of the room where the camera has taken it since its last dark image: what was read there follows it.
  const was = busy ? ClearBox(shots[room], REF, laid, CALM) : null;
  const now = busy ? ClearBox(shots[room], frame, laid, CALM) : null;
  const moved = (b) => (was && now && was.w > 0 && was.h > 0 ? { x: now.x + (b.x - was.x) * (now.w / was.w), y: now.y + (b.y - was.y) * (now.h / was.h), w: (b.w * now.w) / was.w, h: (b.h * now.h) / was.h } : b);

  // 1. Her things, kind by kind (her lights first), each in reading order, as its filler named them: which pieces and on
  // which step taken on its last dark image (seen inside the frame), placed where they are now.
  const DRAW = [
    () => h(Subject, { shot: room, object: "@lampes", style: full }),
    () => h(Subject, { shot: room, object: "@rangees", style: full }),
    () => h(Subject, { shot: room, object: "@tables", style: full }),
    () => h(Subject, { shot: room, object: "@plantes", style: full }),
    () => h(Footage, { shot: room, style: full }),
  ];
  const KINDS = busy ? [
    [SubjectParts(shots[room], REF, laid, "@lampes", 1), SubjectParts(shots[room], frame, laid, "@lampes", 1), 1],
    [SubjectParts(shots[room], REF, laid, "@rangees", 1), SubjectParts(shots[room], frame, laid, "@rangees", 1), 0.45],
    [SubjectParts(shots[room], REF, laid, "@tables", 1), SubjectParts(shots[room], frame, laid, "@tables", 1), 0.45],
    [SubjectParts(shots[room], REF, laid, "@plantes", 1), SubjectParts(shots[room], frame, laid, "@plantes", 1), 0.35],
  ] : [];
  const inside = (p) => p && p.w > 2 && p.h > 2 && p.x + p.w / 2 > 0 && p.x + p.w / 2 < width && p.y + p.h / 2 > 0 && p.y + p.h / 2 < height;
  const pieces = [];
  KINDS.forEach((k, kind) => k[0].forEach((p, i) => { if (inside(p) && pieces.length < 48) pieces.push({ kind, ref: p, box: k[1][i] || p, warm: k[2] }); }));

  // None of her things found (none named, none followed): her lights are the room's small bright spots, read on its
  // light, each much brighter than the ring around it (a lamp, a bulb, a window at night; never a white wall or ceiling,
  // larger than them), the ten strongest, the upper part of the room first, each part left to right, kept on their place
  // as the camera moves.
  const light = busy ? LightUnder(shots[room], REF, laid, null) : null;
  if (busy && !pieces.length && light) {
    const C = 18, R = 32, cw = width / C, ch = height / R;
    const hi = [], lo = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const l = LightUnder(shots[room], REF, laid, { x: c * cw, y: r * ch, w: cw, h: ch });
      hi.push(l ? l.high : -1);
      lo.push(l ? l.mean : -1);
    }
    const at = (a, c, r) => (c < 0 || r < 0 || c >= C || r >= R ? -1 : a[r * C + c]);
    const least = Math.max(0.35, light.mean + 0.12);
    const found = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const p = at(hi, c, r);
      if (p < least) continue;
      let top = true, wide = 0, ring = 0, around = 0;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const q = at(hi, c + dc, r + dr);
        const step = Math.max(Math.abs(dr), Math.abs(dc));
        if (step === 1 && (q > p || (q === p && (dr < 0 || (!dr && dc < 0))))) top = false;
        if (q >= p - 0.12) wide++;
        if (step === 2 && at(lo, c + dc, r + dr) >= 0) { ring += at(lo, c + dc, r + dr); around++; }
      }
      if (!top || wide > 6 || p - (around ? ring / around : 1) < 0.2) continue;
      // Its size: the cells right around it nearly as bright (a shade and its bulb).
      let x0 = c, x1 = c, y0 = r, y1 = r;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (at(hi, c + dc, r + dr) >= p - 0.08) { x0 = Math.min(x0, c + dc); x1 = Math.max(x1, c + dc); y0 = Math.min(y0, r + dr); y1 = Math.max(y1, r + dr); }
      found.push({ lift: p - ring / Math.max(1, around), ref: { x: x0 * cw, y: y0 * ch, w: (x1 - x0 + 1) * cw, h: (y1 - y0 + 1) * ch } });
    }
    const upper = (s) => (s.ref.y + s.ref.h / 2 < height * 0.45 ? 1 : 0);
    found.sort((a, b) => b.lift - a.lift).slice(0, 10).sort((a, b) => upper(b) - upper(a) || a.ref.x + a.ref.w / 2 - (b.ref.x + b.ref.w / 2))
      .forEach((s) => { const box = moved(s.ref); if (inside(box)) pieces.push({ kind: 4, ref: s.ref, box, warm: 1 }); });
  }
  // Pieces that touch (one lamp read as two halves, a bottle and its shine) light together: a group each, in order.
  // Many groups: one or more on each step; few: one a step from the first, the room's own light coming back a notch on
  // each step left.
  const near = (a, b) => {
    const gx = Math.max(a.w, b.w) * 0.12, gy = Math.max(a.h, b.h) * 0.12;
    return a.x - gx < b.x + b.w && b.x - gx < a.x + a.w && a.y - gy < b.y + b.h && b.y - gy < a.y + a.h;
  };
  const groupOf = pieces.map((_, j) => j);
  const root = (j) => (groupOf[j] === j ? j : (groupOf[j] = root(groupOf[j])));
  pieces.forEach((a, i) => pieces.forEach((b, j) => { if (j > i && a.kind === b.kind && near(a.ref, b.ref)) groupOf[root(j)] = root(i); }));
  const groups = [...new Set(pieces.map((_, j) => root(j)))];
  const m = groups.length;
  const S = STEPS.length;
  pieces.forEach((p, j) => { const g = groups.indexOf(root(j)); p.at = S ? STEPS[m >= S ? Math.floor((g * S) / m) : g] : 0; });
  const lit = dark ? pieces.filter((p) => frame >= p.at) : [];
  const notches = dark && m < S ? STEPS.slice(m).filter((s) => frame >= s) : [];
  const lastNotch = notches.length ? notches[notches.length - 1] : -100;

  // 2. The room in the dark, cooler, its light dosed on what the shot shows (a white room in daylight darker than a bar
  // at night); each notch lifts it a little, with a flicker. The whole room at once on the beat, as a breaker thrown:
  // two images brighter, a warm veil, then its own light.
  const DIM = light && light.mean > 0.02 ? Math.min(0.42, Math.max(0.15, 0.075 / light.mean)) : 0.24;
  const dose = DIM / 0.24;
  const flick = frame === lastNotch ? 0.26 : frame === lastNotch + 1 ? 0.1 : 0;
  const breaker = since >= 0 && since < 2 ? [1.3, 1.12][since] : 1;
  const tone = dark ? "brightness(" + Math.min(0.8, dose * (0.24 + 0.04 * notches.length + flick)).toFixed(3) + ") saturate(0.7)" : breaker !== 1 ? "brightness(" + breaker + ")" : "";
  const film = busy ? h(Footage, { shot: room, style: { ...full, ...(tone ? { filter: tone } : {}) } }) : null;
  const night = dark ? h("div", { style: { ...full, background: "#a9b5d4", mixBlendMode: "multiply" } }) : null;
  const bloom = since >= 0 && since < 2 ? h("div", { style: { ...full, background: "#fff1dc", mixBlendMode: "screen", opacity: [0.2, 0.08][since] } }) : null;

  // 3. Each piece lit at its own light (a little brighter and warmer) through its own soft oval, a little larger than
  // its box, with a bloom of its own highlights only (a strong contrast, blurred, laid in screen: its bulb glows, its
  // brass cap stays as it is; half as strong on a spot read on the light, which has no cut-out: a white cloth in its
  // oval must not glow like a bulb); a warm pool spills from it, flickering on as a bulb does; on the beat, the room's
  // own light takes over and the pools fade.
  const ownLight = "brightness(1.18) saturate(1.1)";
  const bloomLight = "contrast(2.6) brightness(1.1) blur(" + Math.max(6, Math.round(height * 0.02)) + "px)";
  const pad = Math.max(4, Math.round(height * 0.012));
  // A spot read on the light shows the room itself around it: its light falls off from its middle, wider, never a disc.
  const oval = (b, spot) => {
    const cx = Math.round(b.x + b.w / 2), cy = Math.round(b.y + b.h / 2);
    if (spot) {
      const sx = Math.round(b.w * 1.1 + 2 * pad), sy = Math.round(b.h * 1.1 + 2 * pad);
      return "radial-gradient(ellipse " + sx + "px " + sy + "px at " + cx + "px " + cy + "px, #000 0%, rgba(0,0,0,0.9) 22%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.12) 80%, rgba(0,0,0,0) 100%)";
    }
    const rx = Math.round(b.w * 0.72 + pad), ry = Math.round(b.h * 0.66 + pad);
    return "radial-gradient(ellipse " + rx + "px " + ry + "px at " + cx + "px " + cy + "px, #000 0%, #000 74%, rgba(0,0,0,0) 100%)";
  };
  const litKinds = DRAW.map((draw, kind) => {
    const these = lit.filter((p) => p.kind === kind);
    if (!these.length) return null;
    const mask = these.map((p) => oval(p.box, kind === 4)).join(", ");
    const cut = () => h("div", { style: { ...full, maskImage: mask, WebkitMaskImage: mask, maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" } }, draw());
    return h(React.Fragment, { key: "l" + kind },
      h("div", { style: { ...full, filter: ownLight } }, cut()),
      h("div", { style: { ...full, filter: bloomLight, mixBlendMode: "screen", opacity: kind === 4 ? 0.45 : 0.85 } }, cut()));
  });
  const WARMUP = [0.5, 1.35, 0.85];
  const pool = (p, a) => {
    const R = Math.round((Math.max(p.box.w, p.box.h) * 0.9 + height * 0.05) * (0.6 + 0.4 * p.warm));
    const cx = Math.round(p.box.x + p.box.w / 2), cy = Math.round(p.box.y + p.box.h / 2);
    const k = Math.max(0, a * p.warm);
    return "radial-gradient(circle " + R + "px at " + cx + "px " + cy + "px, rgba(255,206,146," + (0.5 * k).toFixed(3) + ") 0%, rgba(255,184,112," + (0.2 * k).toFixed(3) + ") 42%, rgba(255,170,96,0) 100%)";
  };
  const pools = [
    ...lit.map((p) => pool(p, frame - p.at < WARMUP.length ? WARMUP[frame - p.at] : 1)),
    ...(since >= 0 && since < 10 ? pieces.map((p) => pool(p, 1 - since / 10)) : []),
  ];
  const spill = pools.length ? h("div", { style: { ...full, background: pools.join(", "), mixBlendMode: "screen" } }) : null;

  // 4. Her name lit like a sign when the whole room comes on (its tube catching over five images), a warm white with a
  // glow, or her colour's on her word, in the calm part of her room, to the cut; its small line under it, lit three
  // images after. A tight dark edge where the wall under it is bright, so it reads on any room.
  const display = "'" + brand.displayFont + "', 'Instrument Serif', 'Georgia', serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const vivid = (c) => {
    const x = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!x) return null;
    const v = parseInt(x[1], 16);
    const rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    const l = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    return l > 0.12 && l < 0.85 ? rgb : null;
  };
  const hers = setting("couleur", "chaude") === "sienne" ? vivid(brand.accent) : null;
  const glowRgb = hers || [255, 176, 92];
  const tube = hers ? "rgb(" + hers.map((c) => Math.round(c + (255 - c) * 0.72)).join(",") + ")" : "#fff3df";
  const NEON = [0, 1, 0.3, 1, 0.55];
  const on = (n) => (n < 0 ? 0 : n < NEON.length ? NEON[n] : 1);
  const fit = Math.min(1, spot.h / (NH + LH));
  const nameBox = { left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(NH * fit) };
  const lineBox = { left: Math.round(spot.x), top: Math.round(spot.y + NH * fit), width: Math.round(spot.w), height: Math.round(LH * fit) };
  const wall = since >= 0 ? LightUnder(shots[room], ALL + 2, laid, { x: nameBox.left, y: nameBox.top, w: nameBox.width, h: nameBox.height + lineBox.height }) : null;
  const edge = wall ? (wall.high > 0.55 ? 0.6 : wall.high > 0.35 ? 0.35 : 0) : 0.35;
  const glow = (size, a) => (edge ? "0 0 2px rgba(24,14,6," + (edge * a).toFixed(2) + "), 0 1px 3px rgba(24,14,6," + (0.8 * edge * a).toFixed(2) + "), " : "") +
    "0 0 " + Math.max(2, Math.round(size * 0.03)) + "px rgba(" + glowRgb.join(",") + "," + (0.95 * a).toFixed(2) + "), 0 0 " + Math.round(size * 0.12) + "px rgba(" + glowRgb.join(",") + "," + (0.75 * a).toFixed(2) + "), 0 0 " + Math.round(size * 0.3) + "px rgba(" + glowRgb.join(",") + "," + (0.45 * a).toFixed(2) + ")";
  const nameOn = hook ? on(since) : 0;
  const name = nameOn > 0
    ? h(FitText, { style: { position: "absolute", ...nameBox }, innerStyle: { fontFamily: display, fontWeight: 400, fontSynthesis: "none", fontSize: Math.round(NS * fit), lineHeight: 1.05, letterSpacing: "0.01em", color: tube, whiteSpace: "nowrap", textAlign: "center", justifyContent: "center", textShadow: glow(NS * fit, 1), opacity: nameOn } }, keep(hook))
    : null;
  const lineOn = small ? on(since - 3) : 0;
  const line = lineOn > 0
    ? h(FitText, { style: { position: "absolute", ...lineBox }, innerStyle: { fontFamily: body, fontWeight: 500, fontSize: Math.round(LS * fit), lineHeight: 1.2, letterSpacing: "0.2em", textTransform: "uppercase", color: tube, whiteSpace: "nowrap", textAlign: "center", justifyContent: "center", textShadow: glow(LS * fit, 0.7), opacity: lineOn } }, h("span", { "data-fauve-accent": "" }, keep(small)))
    : null;

  return h(AbsoluteFill, null, film, night, spill, ...litKinds, bloom, name, line);
}`;

export const rallume: EffectPiece = {
  key: "rallume",
  version: 1,
  name: "La pièce qui se rallume",
  how: "son lieu plonge dans le noir ; ses lampes, ses bouteilles ou ses tasses se rallument une à une, de plus en plus vite, chacune à sa lumière avec un halo chaud et un petit clic ; puis toute la pièce d'un coup sur le temps, et son nom s'allume comme une enseigne dans la partie calme de la pièce, jusqu'à la coupe ; puis le montage reprend.",
  needs: "un plan large (ou moyen) de son lieu vu de l'intérieur, posé ou qui bouge lentement, le soir de préférence, avec dans l'image ses lumières (suspensions, lampes, bougies, guirlande) ou ce qu'il a plusieurs fois (bouteilles alignées, tasses, plantes).",
  lays: "sur un seul de ses plans, ce plan large de son lieu, coupé de 3 à 6 s (la pièce dans le noir, rallumée pièce par pièce, puis toute entière avec son nom allumé jusqu'à la coupe)",
  shots: [1, 1],
  seconds: [3, 7],
  require: { files: 1, shot: { framing: ["wide", "medium"], indoors: true } },
  texts: [
    {
      slot: "nom",
      want: "le nom de son lieu, tel qu'on le lit sur sa devanture : il s'allume comme une enseigne quand toute la pièce se rallume (une ligne ; plus il est court, plus il est grand)",
      max: 18,
      required: true,
    },
    {
      slot: "ligne",
      want: "deux à quatre petits mots en capitales espacées sous son nom : ce qu'on y fait ou quand (« bar à vins », « dès 18 h », « café · Lyon 1er ») ; vide si rien ne s'impose",
      max: 24,
      required: false,
    },
  ],
  objects: [
    {
      slot: "lampes",
      shot: 0,
      want: "ses lumières dans ce plan, chacune à part : ses suspensions, ses lampes, ses bougies, ses ampoules (« every pendant lamp », « every lamp », « every candle »), ou une guirlande, une enseigne lumineuse (« string lights », « neon sign ») ; « none » si aucune ne s'y voit",
    },
    {
      slot: "rangees",
      shot: 0,
      want: "ce qui est aligné dans ce plan, l'un à côté de l'autre : ses bouteilles, ses bocaux, ses livres, ses verres sur une étagère (« every bottle », « every jar ») ; « none » sinon",
    },
    {
      slot: "tables",
      shot: 0,
      want: "ce qui est posé sur ses tables ou son comptoir : ses tasses, ses verres, ses assiettes, ses gâteaux (« every cup », « every wine glass ») ; « none » sinon",
    },
    {
      slot: "plantes",
      shot: 0,
      want: "ses plantes et ses fleurs, ou ce qu'elle vend en série, accroché ou posé : ses bouquets, ses vêtements sur un portant, ses chaussures (« every plant », « every bouquet ») ; « none » sinon",
    },
  ],
  settings: [
    {
      name: "couleur",
      want: "la lumière de son nom allumé",
      choices: [
        { value: "chaude", says: "un blanc chaud, comme une ampoule" },
        { value: "sienne", says: "sa couleur à elle (celle de sa charte ; le blanc chaud si elle est trop pâle ou trop sombre pour briller)" },
      ],
    },
  ],
  timeline: rallumeTimeline,
  code: CODE,
};
