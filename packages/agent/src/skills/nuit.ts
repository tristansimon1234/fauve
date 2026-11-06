import { beatSpans, type MontageSkill, type SkillShot } from "../skills.ts";

// « La nuit sous tous les angles », version 1, written on its original's fiche (docs/fiches/nuit.md: measured image by
// image at 30 i/s, its object located in each angle, its colours read on the pixels, its sound by bands; Tristan: « c'est
// un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). A city at night in 16:9 on a half-time trap
// beat at 136,8 BPM (its hi-hats on every eighth, its snare on beat 3, the drop on 2,425 s): every length below is in
// frames of the original at its own tempo (30 a second), so its cuts fall where the original's do, made into beats:
//   0 – 46      ONE object (its walk signal) in six angles, always at the same place and size, cut on each hit of a roll
//               that speeds up (5 images an angle, then 2), three turns, the last one streaked;
//   46 – 66     a dark blur, then round things in its world (a lens, a bagel, a disc, a clock, a button, a latte, an arrow
//               light) one or two images each at the same place, and the lens again, held: its glass flashes white, the
//               picture turns negative;
//   66 – 78     black, the music cut dead (2,235 s), the drop (2,425 s) on a film burn that slides off to the right;
//   78 – 328    the night in 16 shots of 3 to 40 images: the shot before burnt white and held before the next, a warm
//               panel of light, a cut hidden by a passer-by right before the lens, an orange leak, a shot's first image in
//               negative (a night in negative is white, its lights dark) then white, a shot that comes in in negative, a
//               taxi crossing, a train streaking past, someone taking a photo: their camera turns white, the picture under
//               a white veil, their silhouette white;
//   328 – 360   black, the same burn, the last wide shot of the night cut by the burn again, and the first angle's first
//               image to end: the Reel loops.
// Here her object (her sign, her neon, her door, her tap) is located in each of her angles by its name (the filler names
// it, the engine finds it) and each angle is moved and enlarged so it lands at one place and one size; her round things
// are her close-ups; her night shots take the original's transitions, each at the moment the original lays it. Nothing of
// the original's own (its city, its walk signal, its brands): her place, her object, her night. Horizontal 16:9 on black
// as the original when most of her files are horizontal, else full frame (Tristan: « format par défaut [comme ses
// vidéos], et changement à la demande du user »). Its flashes, its burns and its negative are its original's (« on
// garde »); a photo stays still, a video plays.

const BPM = 136.8;
/** One frame of the original (30 a second) in beats of its music. */
const BEATS = BPM / 1800;
/** Where each of the original's stutter cuts falls (its frames): six angles in turn, the last turn streaked, to the dark blur. */
const STUTTER = [0, 4, 9, 13, 15, 19, 23, 28, 30, 33, 35, 38, 40, 43, 45, 46];
/** Its round things: from the dark blur (46) to the held lens (59), which flashes on 63 and goes black on 66. */
const ROUNDS = 13;
const FLASH = 15;
/** The music: cut dead at 2,235 s (as the picture goes black), the drop at 2,425 s, a beat-1 of its bars. */
const STOP = 67.05;
const DROP = 72.75;
/** The original's night, its 16 shots by role, in frames (the first one from the burn on, the last one with its black and burn). */
const MAIN = [22, 30, 13, 16, 9, 40, 10, 26, 10, 9, 9, 7, 3, 24, 26, 32];
/** Its roles left out first when her files give fewer shots (its opening, its flashes, its photographer and its last stay). */
const LEFT_OUT = [12, 3, 10, 6, 9, 2, 11, 4];
/**
 * How each role comes in: 0 a hard cut, 1 a warm panel of light over the end of the shot before (123 – 124), 2 its first
 * two images in negative (250, 251), 3 a white flash: the last image of the shot before burnt and held three images
 * (96 – 98), 4 an orange leak on the last image of the shot before, its first image in a negative burnt white and two
 * white images (239 – 242).
 */
const ENTRY = [0, 3, 1, 0, 0, 0, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0];
/** The photographer (its camera, then its silhouette white) and the last shot. */
const PHOTO = 14;
const LAST = 15;
/** More of her night for a longer Reel she asks for: shots of three beats before the photographer, coming in by turns. */
const EXTRA_BEATS = 3;
const EXTRA_ENTRY = [1, 2, 0, 3];
/** From the fewest shots (four angles, two round things, the lens, eight of the night), what each one more adds, in order. */
const ADDS = ["m", "m", "a", "r", "a", "m", "r", "m", "m", "r", "m", "r", "m", "m"];
const FEWEST = 15;
const MOST = FEWEST + ADDS.length;
const LONGEST = MOST + 14;
/** The engine's ending card: the Reel's last 1,6 s. */
const END_CARD = 1.6;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** How many angles, round things and night shots n shots make (the lens that flashes besides), and the extra night shots of a longer Reel. */
export function nuitCounts(n: number): { angles: number; rounds: number; main: number; extras: number } {
  const total = Math.max(FEWEST, Math.min(LONGEST, Math.round(n)));
  const counts = { angles: 4, rounds: 2, main: 8, extras: Math.max(0, total - MOST) };
  for (const add of ADDS.slice(0, Math.min(ADDS.length, total - FEWEST))) {
    if (add === "a") counts.angles++;
    else if (add === "r") counts.rounds++;
    else counts.main++;
  }
  return counts;
}

/** Its night's roles for that many of its shots (16 and more: the extra ones), in order, and how each comes in. */
export function nuitRoles(main: number, extras = 0): { roles: number[]; entries: number[] } {
  const out = new Set(LEFT_OUT.slice(0, Math.max(0, Math.min(LEFT_OUT.length, MAIN.length - main))));
  const kept = MAIN.map((_, r) => r).filter((r) => !out.has(r));
  const more = Array.from({ length: extras }, (_, k) => MAIN.length + k);
  const roles = [...kept.slice(0, kept.indexOf(PHOTO)), ...more, ...kept.slice(kept.indexOf(PHOTO))];
  // A role that comes in on a hard cut takes the strongest way in of the roles left out just before it.
  const entries = roles.map((r, i) => {
    if (r >= MAIN.length) return EXTRA_ENTRY[(r - MAIN.length) % EXTRA_ENTRY.length]!;
    const before = i > 0 && roles[i - 1]! < MAIN.length ? roles[i - 1]! : -1;
    let e = ENTRY[r]!;
    for (let q = before + 1; q < r && before >= 0; q++) if (out.has(q)) e = Math.max(e, ENTRY[q]!);
    return e;
  });
  return { roles, entries };
}

/** The angle (of n) the stutter's cut p shows: in turn, its last cut on the last angle as the original's (… A B F); its code deals them so. */
const turnOf = (p: number, n: number) => (p === STUTTER.length - 2 && n > 2 ? n - 1 : p % n);
/** Each angle's time on screen (frames of the original): the stutter's cuts dealt to n angles in turn. */
export const angleFrames = (n: number) => Array.from({ length: n }, (_, a) => STUTTER.slice(0, -1).reduce((sum, f, p) => (turnOf(p, n) === a ? sum + STUTTER[p + 1]! - f : sum), 0));

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const n = shots.length;
  // The original's frames at this Reel's tempo (its stutter, its round things, its flash and its burn are counted in them).
  const S = Math.max(0.5, Math.min(2, mark("scale", 1)));
  const P = (f) => Math.round(f * S);
  const NA = Math.max(1, Math.min(6, n, Math.round(mark("na", 4))));
  const NR = Math.max(1, Math.min(6, Math.round(mark("nr", 2))));
  const FL = Math.min(n - 1, NA + NR);
  const M0 = Math.min(n - 1, FL + 1);
  const len = (i) => Math.max(1, shots[i] ? shots[i].durationInFrames : 1);
  const startOf = (i) => (shots[i] ? shots[i].from : durationInFrames);
  const role = (i) => Math.round(mark("r" + (i - M0), i - M0));
  const entry = (i) => (i >= M0 && i < n ? Math.round(mark("e" + (i - M0), 0)) : 0);

  // Its frame: a horizontal 16:9 picture on black, as the original, when most of her files are horizontal (or she asks),
  // else the whole vertical frame; every place below is in it.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const box ={ position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const fill = (bg, key, extra) => h("div", { key, style: { ...box, background: bg, ...extra } });
  // One image of one of her shots at this frame (k: its image in her passage), held: a photo stays still.
  const pic = (i, k, style, key) => (shots[i] ? h(Footage, { key: key || "p" + i, shot: i, style: { ...box, ...style }, at: frame - Math.max(0, Math.min(len(i) - 1, Math.round(k))) }) : null);

  // 1. Her object at the same place and the same size in every angle (the original's walk signal stays within a
  // hundredth of the frame from one angle to the next): its box read once in each angle, where the engine found it by its
  // name, on her whole picture laid to cover the frame (a horizontal one in a vertical frame keeps its sides: room to move
  // it on); each angle enlarged a little (1,15 times, room to move it) and more until her object is as big as where it is
  // biggest (1,9 times at most), then moved onto the point the most angles can reach, the nearest to the middle, never so
  // far that the picture uncovers an edge (one that cannot reach it comes as near as it can). Not found: as filmed.
  const near = (i) => (shots[i] ? shots[i].from + Math.min(2, len(i) - 1) : 0);
  const whole = (i) => {
    const a = Number(shots[i] && shots[i].aspect) || bw / bh;
    return a >= bw / bh ? { left: 0, top: 0, width: bh * a, height: bh } : { left: 0, top: 0, width: bw, height: bw / a };
  };
  const fit = React.useMemo(() => {
    const seen = [
      NA > 0 ? SubjectBox(shots[0], near(0), whole(0), "@angle1") : null,
      NA > 1 ? SubjectBox(shots[1], near(1), whole(1), "@angle2") : null,
      NA > 2 ? SubjectBox(shots[2], near(2), whole(2), "@angle3") : null,
      NA > 3 ? SubjectBox(shots[3], near(3), whole(3), "@angle4") : null,
      NA > 4 ? SubjectBox(shots[4], near(4), whole(4), "@angle5") : null,
      NA > 5 ? SubjectBox(shots[5], near(5), whole(5), "@angle6") : null,
    ].map((b, i) => (b && b.w > 8 && b.h > 8 && b.w < whole(i).width * 0.9 && b.h < whole(i).height * 0.9 ? b : null));
    const tall = 1.15 * Math.max(0, ...seen.map((b) => (b ? b.h : 0)));
    if (!(tall > 0)) return [];
    const place = seen.map((b, i) => {
      if (!b) return null;
      const s = Math.min(1.9, Math.max(1.15, tall / b.h));
      const w = whole(i).width * s;
      const ht = whole(i).height * s;
      const cx = (b.x + b.w / 2) * s;
      const cy = (b.y + b.h / 2) * s;
      return { w, ht, cx, cy, rx: [cx - (w - bw), cx], ry: [cy - (ht - bh), cy] };
    });
    const within = (v, r) => Math.max(r[0], Math.min(r[1], v));
    // The point the most of these ranges reach, the nearest to the middle among them.
    const most = (ranges, centre) => {
      let pick = centre;
      let count = -1;
      for (const e of ranges.flatMap((r) => r).concat([centre])) {
        const c = ranges.filter((r) => r[0] - 0.5 <= e && e <= r[1] + 0.5).length;
        if (c > count || (c === count && Math.abs(e - centre) < Math.abs(pick - centre))) { count = c; pick = e; }
      }
      return pick;
    };
    const kept = place.filter(Boolean);
    const tx = most(kept.map((p) => p.rx), bw * 0.5);
    const ty = most(kept.map((p) => p.ry), bh * 0.47);
    return place.map((p) => (p ? { left: Math.floor(within(tx, p.rx) - p.cx), top: Math.floor(within(ty, p.ry) - p.cy), width: Math.ceil(p.w) + 1, height: Math.ceil(p.ht) + 1 } : null));
  }, [n, bw, bh, NA]);
  // An image of one of her angles, her picture laid where her object comes to its place (else as the montage frames it).
  const angle = (a, k, style, key) => pic(a, k, fit[a] ? { ...style, ...fit[a] } : style, key);
  // A motion blur along a slant (CSS degrees from the horizontal): an SVG blur in a turned box, its id this image's.
  const D = Math.ceil(Math.hypot(bw, bh));
  const streak = (node, sigma, angle, key) => {
    const id = "nt-" + key + "-" + frame;
    return h("div", { key, style: box },
      h("svg", { width: 0, height: 0, style: { position: "absolute" } },
        h("filter", { id, x: "-10%", y: "-10%", width: "120%", height: "120%", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: sigma.toFixed(1) + " 0" }))),
      h("div", { style: { position: "absolute", left: Math.round((bw - D) / 2), top: Math.round((bh - D) / 2), width: D, height: D, transform: "rotate(" + angle + "deg)", filter: "url(#" + id + ")" } },
        h("div", { style: { position: "absolute", left: Math.round((D - bw) / 2), top: Math.round((D - bh) / 2), width: bw, height: bh, transform: "rotate(" + -angle + "deg) scale(1.08)" } }, node)));
  };

  // 2. Its film burn, the same four images each time it comes (the original's 74 to 77, 330 to 333, 344 to 347): warm
  // white over the whole frame, then the light sliding off to the right, black behind it; opaque, as the original's.
  const MOTTLE = "radial-gradient(circle at 68% 34%, rgba(110,96,86,0.3) 0%, rgba(110,96,86,0) 24%), radial-gradient(circle at 44% 72%, rgba(140,126,112,0.24) 0%, rgba(140,126,112,0) 28%), ";
  const BURNS = [
    "radial-gradient(ellipse 72% 95% at 58% 50%, #f6f2ea 0%, #f2ede3 55%, #e6ddd0 80%, #d6c6b8 100%)",
    "linear-gradient(90deg, #2d2523 0%, #8c847d 20%, #d6cbc0 42%, #e6ddd0 62%, #d0c4b6 100%)",
    "linear-gradient(90deg, #000000 0%, #000000 19%, #373232 24%, #87827c 42%, #c0b5ad 62%, #d0c3b7 100%)",
  ];
  const burn = (k, key) => fill(MOTTLE + BURNS[Math.max(0, Math.min(2, k))], key, { backgroundColor: "#000000" });
  const LEAK = "radial-gradient(circle at 100% 0%, rgba(255,232,168,0.7) 0%, rgba(255,232,168,0) 46%), linear-gradient(90deg, #893d23 0%, #8f4527 25%, #a66138 50%, #c88d51 75%, #daaa63 100%)";

  // 3. Its opening, on the original's frames: the stutter, the dark blur, the round things and the lens that flashes.
  const ST = [0, 4, 9, 13, 15, 19, 23, 28, 30, 33, 35, 38, 40, 43, 45, 46].map(P);
  const RD = [49, 50, 51, 53, 54, 56, 58, 59].map(P);
  const FLASH = P(63);
  const BLACK = P(66);
  const FIRST = startOf(M0);
  const intro = () => {
    if (frame < ST[15]) {
      let p = 0;
      while (p < 14 && frame >= ST[p + 1]) p++;
      // In turn, the last cut on her last angle as the original's (A B C D E F A B C D E F A B F).
      const a = p === 14 && NA > 2 ? NA - 1 : p % NA;
      let k = frame - ST[p];
      for (let q = a; q < p; q += NA) k += ST[q + 1] - ST[q];
      const node = angle(a, k, {}, "an" + a);
      // Its last turn streaks along faster and faster as the roll speeds up, its last angle sharp again.
      return p >= 9 && p <= 13 ? streak(node, 9 + (p - 9) * 7, p % 2 ? 8 : -8, "st" + p) : node;
    }
    if (frame < RD[0]) return h("div", { key: "dip", style: { ...box, filter: "blur(30px) brightness(0.5) saturate(0.6)" } }, pic(FL, 0, {}, "dip"));
    if (frame < RD[7]) {
      let p = 0;
      while (p < 6 && frame >= RD[p + 1]) p++;
      if (p === 0) return pic(FL, 0, {}, "fl");
      const j = (p - 1) % NR;
      let k = frame - RD[p];
      for (let q = j + 1; q < p; q += NR) k += RD[q + 1] - RD[q];
      return pic(NA + j, k, {}, "rd" + j);
    }
    if (frame >= BLACK) return null;
    const k = 1 + frame - RD[7];
    // The lens's glass flashes white, then the whole picture in negative, then black.
    if (frame === FLASH)
      return h("div", { key: "flash", style: box }, pic(FL, k, { filter: "brightness(1.7)" }, "fl"),
        fill("radial-gradient(circle at 50% 50%, #ffffff 0, #ffffff " + Math.round(bh * 0.3) + "px, rgba(255,255,255,0) " + Math.round(bh * 0.44) + "px)", "disc", { mixBlendMode: "screen" }));
    if (frame === FLASH + 1) return pic(FL, k, { filter: "invert(1) contrast(1.15)" }, "fl");
    return pic(FL, k, {}, "fl");
  };

  // 4. Its night: her shot as it plays, each coming in as the original's (the white flash, the panel, the leak and the
  // negatives), the photographer's flash, the black and the burn, the last shot cut by the burn, the loop.
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  let base = null;
  const over = [];
  if (frame < FIRST) base = intro();
  else {
    const t = frame - startOf(cur);
    const left = (cur + 1 < n ? startOf(cur + 1) : durationInFrames) - frame;
    const r = role(cur);
    const e = entry(cur);
    const next = entry(cur + 1);
    base = pic(cur, t);
    // Its flashes as the original's: the shot before burnt white and held (its darkest parts still seen, lifted so that a
    // night burns through too), or hers in negative, which turns a night white and its lights dark (burnt, then white).
    if (cur === M0 && t < Math.max(4, P(4))) { base = null; over.push(burn(Math.floor(t / S), "drop")); }
    else if (e === 3 && t < 3 && cur > M0) { base = null; over.push(pic(cur - 1, len(cur - 1) - 1, { filter: "contrast(0.86) brightness(10) saturate(0.5)" }, "burnt")); }
    else if (e === 4 && t < 3) { base = null; over.push(t === 0 ? pic(cur, 0, { filter: "url(#nt-glare)" }, "burnt") : fill("#fcfcfc", "white")); }
    else if (e === 2 && t < 2) { base = null; over.push(pic(cur, t, { filter: "url(#nt-neg)" }, "burnt")); }
    if (next === 4 && left === 1) over.push(fill(LEAK, "leak"));
    if (next === 1 && (left === 3 || left === 2))
      over.push(fill(left === 3
        ? "linear-gradient(90deg, rgba(244,241,234,0) 0%, rgba(244,241,234,0) 48%, #e8e2d8 54%, #f4f1ea 62%, #f4f1ea 86%, #ded1c5 100%)"
        : "linear-gradient(90deg, rgba(151,140,133,0) 0%, rgba(151,140,133,0) 55%, rgba(151,140,133,0.85) 61%, rgba(222,209,197,0.9) 72%, rgba(46,40,40,0.5) 100%)", "panel"));
    if (r === ${PHOTO} && left <= 4) {
      // Its camera or phone turns white, the picture goes under a grey veil, then its silhouette is white.
      if (left === 4) over.push(h(Subject, { key: "camera", shot: cur, object: "@appareil", fill: "#ffffff", style: box }));
      else if (left > 1) over.push(fill("#ffffff", "veil", { opacity: 0.71 }));
      else over.push(h(Subject, { key: "silhouette", shot: cur, fill: "#d2d4d8", style: box }));
    }
    if (r === ${LAST}) {
      const cutAt = P(16);
      if (t < 2) base = null;
      else if (t < 6) { base = null; over.push(burn(t - 2, "again")); }
      else if (len(cur) >= cutAt + 12 && t >= cutAt && t < cutAt + 4) { base = null; over.push(burn([0, 1, 1, 2][t - cutAt], "mid")); }
      // Without an ending card, its last two images are her first angle's first one: the Reel loops.
      if (!end && frame >= durationInFrames - 2) base = angle(0, 0, {}, "loop");
    }
  }
  // Its film grade on her pictures, held as the original's (its blacks lifted to 9 of 255, its whites at 210 or under:
  // only its flashes and its burns are white); the Reel's finish lays its colours and its grain over all of it.
  const table = (id, values) => h("filter", { id, x: "0", y: "0", width: "100%", height: "100%", colorInterpolationFilters: "sRGB" },
    h("feComponentTransfer", null, ["feFuncR", "feFuncG", "feFuncB"].map((f) => h(f, { key: f, type: "table", tableValues: values }))));
  const grade = h("svg", { width: 0, height: 0, style: { position: "absolute" } },
    table("nt-film", "0.035 0.27 0.5 0.7 0.82"),
    // Its negatives, measured on the original: its cart's (its middle tones dark), its Radio City's (burnt white, its lights grey).
    table("nt-neg", "1 0.76 0.56 0.395 0.265 0.165 0.092 0.044 0.015 0.003 0"),
    table("nt-glare", "1 1 1 0.96 0.88 0.8 0.72 0.64 0.56 0.48 0.4"));

  // 5. Her name when the Reel has one (the original writes none): fine white capitals, widely spaced, in the middle of the
  // first shot of her night as the burn leaves it, gone with the panel of light; her ending card over the last shot.
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const display = "'" + brand.displayFont + "', 'Bodoni Moda', serif";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  const shade = "0 0 2px rgba(0,0,0,0.45), 0 2px 18px rgba(0,0,0,0.5)";
  // The middle of its frame, in the frame's own place (its words are laid in it: in the band, its middle is the screen's).
  const mid = Math.round(bh / 2);
  const line = (text, top, tall, size, family, weight, key, spaced) =>
    h(FitText, { key, style: { position: "absolute", left: 140, top, width: width - 280, height: tall }, innerStyle: { fontFamily: family, fontWeight: weight, fontSynthesis: "none", fontSize: size, lineHeight: 1.05, letterSpacing: spaced ? "0.14em" : "0.02em", textTransform: spaced ? "uppercase" : "none", color: "#ffffff", textAlign: "center", textWrap: "balance", textShadow: shade } }, keep(text));
  const endAt = end ? end.from : durationInFrames + 1;
  const title = hook && frame >= hook.from && frame < Math.min(hook.to, endAt) ? line(hook.text, mid - 80, 160, 104, display, 700, "title-" + hook.text, true) : null;
  const ending = end && frame >= endAt
    ? h(React.Fragment, null,
        fill("#000000", "card-veil", { opacity: 0.35 }),
        line(end.title, mid - (end.subtitle ? 170 : 90), 160, 96, display, 700, "card-" + end.title, true),
        end.subtitle ? line(end.subtitle, mid + 10, 130, 50, body, 500, "card2-" + end.subtitle, false) : null)
    : null;
  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } },
    grade, base ? h("div", { key: "base", style: { ...box, filter: "url(#nt-film)" } }, base) : null, ...over, title, ending);
  // Any other text of the Reel (none in its slots): a plain white line above its frame in width, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < t.to && frame < endAt).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: shade } }, keep(t.text)));
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

/** What each of its slots wants of her files, for the filler (French). */
const ANGLE = (k: number) =>
  `${k === 0 ? "le premier angle, le plus beau : " : `un autre angle (${k + 1}e endroit) du même objet : `}son enseigne ou l'objet qui la représente (son néon, son logo sur la vitrine, sa porte, sa tireuse, une lampe), net et bien visible, ${k === 0 ? "de face" : "d'un autre endroit que les autres angles (de côté, de plus loin, d'en bas)"} ; le moteur le recale au même endroit et à la même taille dans chaque angle`;
const ROUND =
  "un gros plan d'une chose ronde de son monde, de face ou de dessus, au milieu de l'image : un verre vu de haut, une assiette, une pizza, un café, une horloge, un vinyle, une lampe ronde (une photo convient : elle passe une ou deux images)";
const LENS =
  "le dernier rond, celui qui flashe : une lampe, une ampoule, un spot, l'objectif d'un appareil photo ou d'un téléphone, de face et au milieu (il passe une image au début des ronds, puis tenu à la fin : il s'éclaire en blanc, en négatif, puis le noir)";
const WANTS = [
  "le premier plan de sa nuit, large et calme : sa rue, sa devanture ou son quartier la nuit, de préférence à travers quelque chose (une vitre, un grillage, des feuilles) ; il arrive après le noir, sur une brûlure de pellicule",
  "une rue ou une façade en contre-plongée, entre deux immeubles ou sous un pont (il arrive après un flash blanc)",
  "des néons, des écrans, des vitrines allumées la nuit, du monde",
  "un plan sombre et calme : des lampadaires, de l'eau ou une rue mouillée, quelqu'un qui s'éloigne",
  "un plan qui commence caché par quelqu'un ou quelque chose qui passe tout près de l'objectif, puis découvre sa rue ou son lieu (la coupe s'y cache)",
  "quelque chose qui passe vite devant l'objectif : un métro, un tram, un bus, des voitures",
  "un plan symétrique : un plafond, une verrière, un couloir, sa salle vue du milieu",
  "une contre-plongée vers le haut : une façade, une enseigne, un immeuble, un arbre, un lustre (il finit sur une lumière orange)",
  "son enseigne allumée la nuit, de près ou en contre-plongée (elle arrive en négatif, dans un flash blanc)",
  "son comptoir, son bar ou son étal allumé la nuit, avec du monde (il arrive en négatif)",
  "une rue la nuit à contre-jour : des silhouettes, des phares, de la brume ou de la vapeur",
  "quelqu'un de dos qui regarde la nuit, et quelque chose qui passe devant (une voiture, un vélo)",
  "un détail de couleur qui passe vite : un taxi, un vélo, un bus, un néon",
  "un plan qui file : une rame qui passe, une rue filmée d'une voiture ou d'un vélo",
  "quelqu'un qui prend une photo, de face ou de trois quarts, l'appareil ou le téléphone levé, net (au flash, son appareil puis sa silhouette deviennent blancs)",
  "le plan qui finit : large et calme, sa rue, sa devanture ou sa ville la nuit, ses lumières, une seconde au moins",
];
const EXTRA = "encore un moment de sa nuit : un geste au comptoir, un verre servi, des gens qui rient, une rue, une lumière";

export const nuit: MontageSkill = {
  key: "nuit",
  // 2: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 2,
  bpm: BPM,
  shots: [FEWEST, MOST],
  files: [6, 20],
  // A longer Reel she asks for: more of her night (shots of three beats before the photographer), to 30 s at its own tempo.
  long: LONGEST,
  // The moments something passes right before her lens, measured on her videos: its hidden cut gets a real one.
  reads: ["covered"],
  how: "Sa nuit sous tous les angles, en vertical plein écran (en horizontal 16:9 comme l'original à sa demande) : son enseigne (ou l'objet qui la représente) vue sous quatre à six angles, toujours au même endroit et à la même taille, coupée de plus en plus vite sur un roulement qui accélère, le dernier tour filé ; puis ses choses rondes qui se remplacent au même endroit, une ou deux images chacune, jusqu'à la dernière qui s'éclaire en blanc et passe en négatif ; le noir et un silence, et la musique tombe sur une brûlure de pellicule : sa nuit en plans d'une demi-seconde à une seconde, enchaînés en flashs blancs, en négatifs (sa nuit devient blanche, ses lumières sombres), en brûlures, en coupes cachées par quelqu'un qui passe, une lumière orange, quelqu'un qui prend une photo au flash (son appareil puis sa silhouette deviennent blancs) ; un dernier plan large de sa nuit coupé d'une brûlure, qui revient sur la première image de son enseigne pour boucler.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "facultatif : son nom ou celui de son lieu (sa rue, son quartier), posé en capitales fines et espacées au milieu du premier plan de sa nuit, juste après la brûlure ; 1 ou 2 mots",
      max: 20,
      required: false,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran, ou horizontal 16:9 comme l'original",
      choices: [
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original", band: true },
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
      ],
    },
  ],
  // Her object in each angle (to set it at one place and size), and the camera or phone of the one who takes a photo.
  objects: [
    ...Array.from({ length: 6 }, (_, k) => ({ slot: `angle${k + 1}`, shot: k, want: "l'objet qui revient dans chaque angle : son enseigne, son néon, son logo, sa porte, sa tireuse, sa lampe (le même nom dans chaque angle)" })),
    { slot: "appareil", shot: -2, want: "l'appareil photo ou le téléphone que la personne lève pour prendre la photo" },
  ],
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length counted in beats follows it.
    const bpm = options.bpm ?? BPM;
    const scale = BPM / bpm;
    const s = (f: number) => round3((f * scale) / 30);
    const counts = nuitCounts(n);
    const { roles, entries } = nuitRoles(counts.main, counts.extras);
    const beat = 60 / bpm;
    const card = options.end ? Math.ceil((END_CARD + 0.05) / beat) : 0;
    const rounds = Array.from({ length: counts.rounds }, (_, j) => Math.floor((ROUNDS * (j + 1)) / counts.rounds) - Math.floor((ROUNDS * j) / counts.rounds));
    const beats = [
      ...angleFrames(counts.angles).map((f) => f * BEATS),
      ...rounds.map((f) => f * BEATS),
      FLASH * BEATS,
      ...roles.map((r) => (r >= MAIN.length ? EXTRA_BEATS : MAIN[r]! * BEATS + (r === LAST ? card : 0))),
    ];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const wants = [
      ...Array.from({ length: counts.angles }, (_, k) => ANGLE(k)),
      ...Array.from({ length: counts.rounds }, () => ROUND),
      LENS,
      ...roles.map((r) => (r >= MAIN.length ? EXTRA : WANTS[r]!)),
    ];
    const first = counts.angles + counts.rounds + 1;
    const photo = first + roles.indexOf(PHOTO);
    // Each of the original's stutter cuts and round things, a hit of its roll that speeds up (its frames 4 to 59).
    const hits = [...STUTTER.slice(1), 49, 50, 51, 53, 54, 56, 58, 59];
    return {
      duration,
      shots: spans.map((span, i): SkillShot => ({ ...span, want: wants[i]! })),
      // Her name from the first image of her night after the burn (78) to the cut after the panel of light (126): 1,6 s.
      texts: { titre: { from: s(78), to: s(126) } },
      marks: {
        scale: round3(scale),
        na: counts.angles,
        nr: counts.rounds,
        ...Object.fromEntries(roles.map((r, j) => [`r${j}`, r])),
        ...Object.fromEntries(entries.map((e, j) => [`e${j}`, e])),
      },
      // Her angles' object on each angle (none past them), the camera on the shot of the one who takes a photo.
      objects: { ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [`angle${k + 1}`, k < counts.angles ? k : 99])), appareil: photo },
      // Cut out on that shot only: its silhouette turns white at the flash.
      cutouts: [photo],
      sounds: [
        // Its roll, a tick on each cut of the stutter and of the round things, louder and louder as it speeds up.
        { at: s(4), sound: "short tight hi-hat tick", seconds: 0.5, gain: -4, burst: { times: hits.map((f) => s(f - 4)), gains: hits.map((_, k) => Math.round(-10 + (10 * k) / (hits.length - 1))) } },
        // A shutter as the lens flashes, and as the one who takes a photo does (their camera white).
        { at: s(63), sound: "camera shutter click", seconds: 0.5, gain: 2 },
        { at: round3(spans[photo]!.end - 4 / 30), sound: "camera shutter click", seconds: 0.5, gain: 2 },
      ],
      // Its music without its bass under the stutter (the original's riser), cut dead as the picture goes black, the
      // drop on its beat 1 (2,425 s) as the burn comes; cut with the last image, so the Reel loops (faded under a card).
      music: {
        downbeat: s(DROP),
        filters: [{ kind: "thin", from: 0, to: s(STOP) }],
        pauses: [{ from: s(STOP), to: s(DROP) }],
        end: { at: duration, fade: options.end ? 0.8 : 0.012 },
      },
    };
  },
  code: CODE,
};
