import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Titre derrière le décor », version 2, written again on its original's fiche (docs/fiches/titre-derriere.md:
// measured image by image at 30 i/s, its music measured and laid against « Lieu tapé »'s, the video watched and heard by
// Gemini; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image », its scenery her
// street, her roofs, her trees or a landscape « quand ça a du sens »). Its music is a lo-fi beat at 82,9 BPM (Gemini
// heard 85) that stops dead one beat in every bar; every length below is in its beats from its first beat (the
// original's image 2: its two images before it are left out, the Reel starts on its music's first beat), so its cuts
// fall where the original's do on its own music (within two images):
//   0 – 4,55   a wide still shot of her street or her landscape: in silence, a low whoosh rises into a hit (half a beat
//              in) and the giant title rises from below onto it in three images, blurred upwards, flat blood red, across
//              the frame's width in its sky, its foot half a capital under the top of what stands in front (her roofs,
//              her trees, her hills, named by the filler: they pass in front of it); three small pen words between two
//              crosses on each side just above it, an image later; the music comes in on beat 2 and the scenery turns
//              to white paper piece by piece, left to right, then a white wave runs over the title's letters, one at a
//              time; the title goes with the cut, on the snare;
//   then a calm shot while the music stops (beat 5), three flash shots of a quarter beat on its return, a still shot
//   where what repeats turns white one piece after the other going up, then its middle one, a shot that turns fast, her
//   sign blinking white one image in two as the music stops again, a shot that moves towards her door opening on a zoom
//   blur (a dry knock in the stop), a wall whose frames turn white one by one from the cut while the big thing in front
//   of it flashes white twice and the white silhouette of the next shot's subject stands in its place, that shot (her,
//   backlit) on the next stop, a burst of shots a sixth of a beat each from beat 14, a last close shot cut dead just
//   after the last snare.
// Played as the original, a horizontal 4:3 picture on black, when her files are mostly horizontal (or she asks), else
// full frame (Tristan: « format par défaut [comme ses vidéos], et changement à la demande du user »). Her shots as
// filmed (a photo stays still, a video plays); its one zoom blur kept (Tristan, of its originals' zooms: « on garde »).
// Nothing of the original's own is copied: its words (« A month in », « LOS ANGELES ») are hers, its city her place.

const BPM = 82.9;
/** Its sections before the burst, in beats of its music from its first beat (the original's 0 · 4,56 · 6,03 · 6,31 · 6,54 · 6,81 · 7,92 · 8,52 · 9,30 · 10,08 · 12,57 · 14). */
const TITLE = 4.55;
const CALM = 1.45;
const FLASHES = [0.25, 0.25, 0.25];
const WHEEL = 1.15;
const TURN = 0.6;
const SIGN = 0.8;
const DOOR = 0.7;
const WALL = 2.55;
const BACKLIT = 1.45;
/** Past its 23 shots (a length she asks for), bars of a held shot and a calm one on the music's stop, before the burst (an odd one: one shot of a bar). */
const PHRASE = [2.55, 1.45];
const BAR = 4;
/** The burst from beat 14: a sixth of a beat a shot (3 or 4 images), 11 at most; the Reel ends just after the snare of beat 16,5. */
const BURST = 1 / 6;
const BURST_MOST = 11;
const ENDS = 16.533;
/** In beats: the title's hit (the original's 0,40 s), the paper chase from the music's return, the wave, the wheel's chase, the flashes of the wall's big thing, its next shot's silhouette, the dry knock in the third stop. */
const HIT = 0.5;
const CHASE = 2;
const WAVE = 3;
const PIECES = 7.35;
const FLASH = 11.55;
const GHOST = 12;
const KNOCK = 9.52;
/** The engine's ending card: the Reel's last 1.6 s (motion.ts, END_CARD_SECONDS); its last shot held whole bars of two beats longer for it, so it still ends on a snare. */
const END_CARD = 1.6;
const LONG = 35;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const HIT = mark("hit", 11);
  const CHASE = mark("chase", 45);
  const WAVE = mark("wave", 65);
  const PIECES = mark("pieces", 160);
  const FLASH = mark("flash", 251);
  const GHOST = mark("ghost", 261);
  // Its title's vertical blur, its own (two copies of the scene in one page never share one).
  const BLUR = "td" + String(React.useId ? React.useId() : "0").replace(/[^a-zA-Z0-9_-]/g, "");
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  const endAt = end ? end.from : durationInFrames + 1;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const cutOf = (k) => (shots[k] ? shots[k].from + shots[k].durationInFrames : -1);

  // Its frame: a horizontal 4:3 picture on black, as the original, when most of her files are horizontal (or she asks),
  // else the whole vertical frame; every place below is a share of it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 3) / 4) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const box = { position: "absolute", left: 0, top: 0, width: bw, height: bh };

  // The original's own colours, measured: its blood red, the paper white of its silhouettes, the brighter white of its
  // wave, the warm white of its pen words.
  const RED = "#640005";
  const PAPER = "#EFEDE9";
  const LIT = "#FCF8F9";
  const INK = "#FFF5ED";
  const display = "'" + brand.displayFont + "', 'Archivo Black', 'Arial Black', sans-serif";
  const pen = "'Nothing You Could Do', 'Caveat', '" + brand.bodyFont + "', cursive";
  const body = "'" + brand.bodyFont + "', 'Inter', sans-serif";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1\u00a0");
  const letters = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const hook = reelTexts.find((t) => t.role === "hook");
  const small = reelTexts.find((t) => t.role === "caption");
  const others = reelTexts.filter((t) => t !== hook && t !== small);

  // 1. Her shots in its frame, cut on its beats, as filmed. Full frame, a video in width seen again shows the part of its
  // picture next to the first one, never a closer frame; in its 4:3 frame, as it is.
  const again = (i) => {
    let k = 0;
    for (let j = 0; j < i; j++) if (shots[i] && shots[i].src && shots[j].src === shots[i].src) k++;
    return k;
  };
  const place = (i) => {
    const sh = shots[i];
    const k = sh ? again(i) : 0;
    const a = sh ? Number(sh.aspect) || 0.5625 : 0.5625;
    if (!wide && k && k <= 2 && a > 1.2) {
      const W = Math.round(bh * a);
      const room = W - bw;
      const fx = sh.focus && Number.isFinite(sh.focus.x) ? sh.focus.x : 0.5;
      const first = Math.max(0, Math.min(room, fx * W - bw / 2));
      const toward = first > room / 2 ? -1 : 1;
      const left = Math.max(0, Math.min(room, first + (k === 1 ? toward : -toward) * 0.6 * bw));
      if (Math.abs(left - first) >= 0.3 * bw) return { position: "absolute", left: -Math.round(left), top: 0, width: W, height: bh };
    }
    return box;
  };
  // The shot that moves towards her door opens on a zoom blur, streaks from its middle (the original's image 204, less on
  // 205), then plays as filmed: copies of its picture a little larger each, of equal weight.
  const door = shots[8];
  const zoom = door && frame < endAt && frame >= door.from && frame < door.from + 2 ? (frame === door.from ? 0.06 : 0.012) : 0;
  const film = zoom
    ? h("div", { style: { ...box, overflow: "hidden" } }, [0, 1, 2, 3, 4, 5].map((i) => h("div", { key: i, style: { ...box, transform: "scale(" + (1 + zoom * i).toFixed(3) + ")", opacity: Number((1 / (i + 1)).toFixed(3)) } }, h(Footage, { shot: 8, style: place(8) }))))
    : h(Footage, { shot: cur, style: place(cur) });

  // 2. Its title: one line of very bold capitals across 90,7 % of the frame's width, flat blood red, in the sky of her
  // first shot, behind what stands in front (her roofs, trees or hills, cut out and laid over it: « @decor »), its
  // foot half a capital under the top of it (the original's crowned tower), else on the bottom of her sky or calm wall,
  // else the original's place (its foot at 41,3 % of the height). It stays on the scenery, moving with its camera.
  const chars = hook ? letters(keep(hook.text).toUpperCase()) : [];
  const TW = Math.round(bw * 0.907);
  const capsMost = Math.round(wide ? bh * 0.2 : height * 0.1);
  // Its capitals, about its width over its letters (a black grotesque, set tight); its size before it fits the width.
  const caps = Math.min(capsMost, Math.round(TW / Math.max(4, chars.length)));
  const F0 = Math.round(capsMost / 0.69);
  // Its small words above it and its foot inside the Reel's safe zone, its glyphs above the apps' buttons.
  const footMin = Math.round((wide ? bh * 0.04 : 80) + 1.65 * caps);
  const footMax = Math.round(940 - by - 0.3 * caps);
  const LAND = HIT + 1;
  // The top of what stands in front across the title's width: its outline's highest point in each sixth of it, the
  // second highest kept (a pole or a flag may rise past it, as the original's pole through its E), else the top of its box.
  const outline = SubjectOutline(shots[0], LAND, laid, "@decor");
  const nums = outline ? (String(outline).match(/-?\d+(?:\.\d+)?/g) || []).map(Number) : [];
  const bands = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const b = Math.floor(((nums[i] - (bw - TW) / 2) / TW) * 6);
    if (b >= 0 && b < 6) bands[b] = Math.min(bands[b], nums[i + 1]);
  }
  const tops = bands.filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
  const decor = SubjectBox(shots[0], LAND, laid, "@decor");
  const top = tops.length >= 4 ? tops[1] : tops.length ? tops[0] : decor ? decor.y : null;
  // Behind it when its foot can dip half a capital into it; what rises higher is not laid over it (the title in front).
  const behind = top !== null && top >= footMin - 0.5 * caps;
  const SKY = { prefer: "top", min: { w: Math.round(bw * 0.55), h: Math.round(bh * 0.08) }, within: { x: 0, y: 0, w: bw, h: footMax }, origin: { x: 0, y: by }, pad: 4, fallback: null };
  const sky = ClearBox(shots[0], LAND, laid, SKY);
  const foot = Math.round(Math.max(footMin, Math.min(footMax, behind ? top + 0.5 * caps : sky ? sky.y + sky.h : bh * 0.413)));
  const skyNow = cur === 0 && sky ? ClearBox(shots[0], frame, laid, SKY) : null;
  const dx = skyNow ? skyNow.x - sky.x : 0;
  const dy = skyNow ? skyNow.y - sky.y : 0;
  // It rises from below in three images onto the hit, decelerating (its capitals 0,65 · 0,29 · 0,09 · 0,015 under its
  // place), blurred upwards; its small words an image later, the same small move, fading in (26 %, 90 %).
  const RISE = [0.647, 0.294, 0.088, 0.015];
  const lift = (k) => (k >= 0 && k < 4 ? RISE[k] : 0);
  const titleOn = hook && cur === 0 && frame >= hook.from && frame < Math.min(hook.to, endAt);
  const t = hook ? frame - hook.from : -1;
  const smear = t >= 0 && t < 3 ? [0.16, 0.09, 0.03][t] * capsMost : 0;
  const u = small ? frame - small.from : -1;
  // A white wave over its letters, one at a time, left to right (the space skipped), from the beat after the paper:
  // 2,4 images a letter, quicker for a long word, done before the cut.
  const units = chars.map((c, i) => i).filter((i) => /\S/.test(chars[i]));
  const STEP = Math.max(1.6, Math.min(2.4, (cutOf(0) - 6 - WAVE) / Math.max(1, units.length)));
  const wk = frame >= WAVE ? Math.floor((frame - WAVE) / STEP) : -1;
  const litAt = wk >= 0 && wk < units.length ? units[wk] : -1;
  const word = litAt < 0 ? chars.join("") : chars.map((c, i) => h("span", { key: i, style: { color: i === litAt ? LIT : RED } }, c));
  const titleStyle = { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: F0, lineHeight: 0.69, letterSpacing: "-0.02em", color: RED, whiteSpace: "nowrap", fontKerning: "none", fontVariantLigatures: "none", transform: "translateY(" + (lift(t) * capsMost).toFixed(1) + "px)", filter: smear > 0.3 ? "url(#" + BLUR + ")" : "none" };
  // One box for both, its bottom on the title's foot: a long title is smaller, its small words with it (their capitals
  // 41 % of its own, just above it). Every letter in the page from its first image, so its size is measured once.
  const smallStyle = { fontFamily: pen, fontSize: Math.round(capsMost * 0.554), lineHeight: 0.8, color: INK, whiteSpace: "nowrap", marginBottom: Math.round(capsMost * 0.02), opacity: u < 0 ? 0 : u === 0 ? 0.26 : u === 1 ? 0.9 : 1, transform: "translateY(" + (lift(u + 1) * capsMost * 0.41).toFixed(1) + "px)", textShadow: "0 1px 2px rgba(0,0,0,0.3)" };
  const boxH = Math.round(F0 * 1.45);
  const title = titleOn
    ? h(React.Fragment, { key: "title" },
        h("svg", { width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": "true" },
          h("filter", { id: BLUR, x: "-5%", y: "-60%", width: "110%", height: "220%" }, h("feGaussianBlur", { stdDeviation: "0 " + smear.toFixed(2) }))),
        h(FitText, { style: { position: "absolute", left: Math.round((bw - TW) / 2 + dx), top: Math.round(foot + dy - boxH), width: TW, height: boxH }, innerStyle: { justifyContent: "flex-end" } },
          h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
            small ? h("div", { "data-fauve-accent": "", style: smallStyle }, "++\u2003" + keep(small.text) + "\u2003++") : null,
            h("div", { style: titleStyle }, word))))
    : null;
  // What stands in front of it, cut out at every image and laid over it.
  const decorOver = titleOn && behind ? h(Subject, { shot: 0, object: "@decor", style: box }) : null;

  // 3. The scenery in white paper, piece by piece: one piece of what was named in the shot (each one of « every … »,
  // else slices of it) a silhouette of paper white at a time, 2 to 3 images each, the others themselves; at its depth
  // (over the title, under her). Nothing in pieces: what is cut out in the shot turns white at once for 3 images. A
  // piece alone is the picture kit's Subject part (the k-th of SubjectParts): cut to its own outline when the card read
  // it apart (two towers that overlap no longer whiten together), else to its box and a pad of 1,2 % of the height.
  const paperPiece = (shot, object, all, p, slices) => h(Subject, { shot, object, part: all.indexOf(p), slices, fill: PAPER, style: box });
  // Its middle one (the hub of a wheel, the poster in the middle of a wall): the piece nearest the middle of them all.
  const middle = (parts) => {
    const cx = parts.reduce((a, p) => a + p.x + p.w / 2, 0) / parts.length;
    const cy = parts.reduce((a, p) => a + p.y + p.h / 2, 0) / parts.length;
    const d = (p) => Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy);
    return parts.reduce((m, p) => (d(p) < d(m) ? p : m), parts[0]);
  };
  // The piece lit at this frame: one after the other from its first image, so many images each; held: the last to the cut.
  const at = (parts, from, each, hold) => {
    if (!parts.length || frame < from) return null;
    const i = Math.floor((frame - from) / each);
    return i < parts.length ? parts[i] : hold ? parts[parts.length - 1] : null;
  };
  // On her first shot from the music's return: left to right, then the wave five images later.
  const all0 = cur === 0 && frame >= CHASE && frame < WAVE ? SubjectParts(shots[0], frame, laid, "@decor", 5) : [];
  const parts0 = all0.slice().sort((a, b) => a.x - b.x).slice(0, 6);
  const p0 = at(parts0, CHASE, parts0.length ? Math.max(2, Math.min(3, (WAVE - 5 - CHASE) / parts0.length)) : 3, false);
  const paper0 = p0 ? paperPiece(0, "@decor", all0, p0, 5) : null;
  const plain0 = cur === 0 && !parts0.length && frame >= CHASE && frame < CHASE + 3 ? h(Subject, { shot: 0, fill: PAPER, style: box }) : null;
  // Her, cut out, in front of the title and of the white scenery when her head rises into it, never when she towers over it.
  const her0 = cur === 0 ? SubjectBox(shots[0], LAND, laid) : null;
  const her = titleOn && her0 && her0.y >= foot - 1.15 * caps ? h(Subject, { shot: 0, style: box }) : null;
  // On the still shot where something repeats: three going up, then its middle one, held to the cut.
  const parts5 = cur === 5 && frame >= PIECES ? SubjectParts(shots[5], frame, laid, "@morceaux", 0) : [];
  const up5 = parts5.length > 2 ? [...parts5.filter((p) => p !== middle(parts5)).sort((a, b) => b.y + b.h - (a.y + a.h)).slice(0, 3), middle(parts5)] : parts5;
  const p5 = at(up5, PIECES, Math.max(2, (cutOf(5) - PIECES) / Math.max(1, up5.length)), true);
  const paper5 = p5 ? paperPiece(5, "@morceaux", parts5, p5, 0) : cur === 5 && frame >= PIECES && frame < PIECES + 3 ? h(Subject, { shot: 5, object: "@morceaux", fill: PAPER, style: box }) : null;
  // On the wall from its cut: its frames one at a time in reading order, then the middle one again, 2,5 images each.
  const parts9 = cur === 9 ? SubjectParts(shots[9], frame, laid, "@cadres", 0).slice(0, 5) : [];
  const walk9 = parts9.length > 2 ? [...parts9, middle(parts9)] : parts9;
  const p9 = shots[9] ? at(walk9, shots[9].from, 2.5, false) : null;
  const paper9 = p9 ? paperPiece(9, "@cadres", parts9, p9, 0) : null;
  const plain9 = cur === 9 && !parts9.length && frame >= shots[9].from && frame < shots[9].from + 3 ? h(Subject, { shot: 9, fill: PAPER, style: box }) : null;

  // 4. Her sign blinks white one image in two over its last eight images, as the music stops (the original's 1 0 1 0 1 1
  // 0 1); what stands in front of it stays in front.
  const BLINKS = [1, 0, 1, 0, 1, 1, 0, 1];
  const left7 = cutOf(7) - frame;
  const blink = cur === 7 && left7 >= 1 && left7 <= 8 && BLINKS[8 - left7] ? h(Subject, { shot: 7, object: "@enseigne", fill: PAPER, style: box }) : null;

  // 5. The big thing in front of the wall (what is cut out in it) in paper white for one image, twice, three apart; then,
  // from the beat, the next shot's subject as a still white silhouette at its place, to the cut that shows it.
  const flash9 = cur === 9 && (frame === FLASH || frame === FLASH + 3) ? h(Subject, { shot: 9, fill: PAPER, style: box }) : null;
  const ghost = cur === 9 && frame >= GHOST ? h(Subject, { shot: 10, fill: PAPER, style: place(10) }) : null;

  // 6. Its ending card, when she has one: the last shot darkened, its words rising in the title's capitals in white,
  // a pen line under them.
  const e = end ? frame - endAt : -1;
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { ...box, backgroundColor: "rgba(0,0,0," + (0.45 * Math.min(1, (e + 1) / 6)).toFixed(3) + ")" } }),
        h(FitText, { style: { position: "absolute", left: 140, top: Math.round(bh / 2) - (end.subtitle ? 190 : 110), width: bw - 280, height: 220 }, innerStyle: { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: 100, lineHeight: 0.96, letterSpacing: "-0.02em", color: LIT, textAlign: "center", textWrap: "balance", whiteSpace: "normal", justifyContent: end.subtitle ? "flex-end" : "center" } },
          h("span", { style: { display: "inline-block", opacity: e >= 2 ? 1 : 0, transform: "translateY(" + (lift(e - 2) * 70).toFixed(1) + "px)" } }, keep(end.title).toUpperCase())),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: 140, top: Math.round(bh / 2) + 40, width: bw - 280, height: 150 }, innerStyle: { fontFamily: pen, fontSize: 64, lineHeight: 1.1, color: INK, textAlign: "center", textWrap: "balance", justifyContent: "flex-start", textShadow: "0 1px 2px rgba(0,0,0,0.4)" } },
              h("span", { style: { opacity: interpolate(frame, [endAt + 6, endAt + 11], [0, 1], clamp) } }, keep(end.subtitle)))
          : null)
    : null;

  // Its white pieces at their depth: over the title when the scenery passes in front of it, under it otherwise.
  const first = behind ? [title, decorOver, paper0, plain0] : [paper0, plain0, title];
  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } }, film, ...first, her, paper5, blink, paper9, plain9, flash9, ghost, ending);

  // Any other text of the Reel (none in its slots): a plain white line, above its frame in width, so nothing she wrote is lost.
  const extra = others.filter((x) => frame >= x.from && frame < Math.min(x.to, endAt)).map((x, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 130 - i * 120) : 1250 - i * 130, height: 110 }, innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, keep(x.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

export const titreDerriere: MontageSkill = {
  key: "titre-derriere",
  // 2: written again on its original's fiche: its format (horizontal 4:3 when her files are), its tempo (82,9 BPM) and
  // its 23 cuts, its music stopped one beat a bar, its title rising from below onto a hit behind her scenery, its
  // paper-white pieces, its wave one letter at a time, its blinking sign, its zoom blur, its flashes, the next shot's
  // silhouette, its burst in sixths of a beat, its dead cut; its finish without grain nor corners.
  version: 2,
  bpm: BPM,
  shots: [14, 23],
  // Up to 35 for a length she asks for: about 30 s at its own tempo (bars of a held shot and a calm one before the burst).
  long: LONG,
  files: [5, 14],
  how: "Un plan large et fixe de sa rue ou de son paysage où, sur un coup, son titre géant monte d'en bas dans le ciel, en capitales noires très grasses d'un rouge sang, derrière le décor (ses toits, ses arbres, ses collines passent devant), trois petits mots au stylo entre deux croix au-dessus ; à la reprise de la musique, le décor devient papier blanc morceau par morceau, puis une vague blanche passe sur les lettres ; un plan calme pendant que la musique s'arrête, trois plans éclair, ce qui se répète dans un plan qui blanchit une pièce après l'autre, son enseigne qui clignote en blanc, un plan qui avance vers sa porte dans un flou de zoom, un mur garni dont les cadres blanchissent pendant que l'objet devant flashe, la silhouette blanche de la personne du plan suivant, elle en contre-jour, une rafale de plans très courts et un dernier plan de près, coupé net. En horizontal 4:3 comme l'original quand ses vidéos le sont.",
  end: true,
  texts: [
    {
      slot: "surtitre",
      role: "caption",
      want: "2 ou 3 petits mots écrits au stylo au-dessus du titre, entre deux petites croix de chaque côté, qui l'amènent (une forme comme « un mois à », « un samedi à », « bienvenue à »)",
      max: 18,
      required: true,
    },
    {
      slot: "titre",
      role: "hook",
      want: "le titre géant posé dans le ciel de son premier plan, derrière le décor, sur une ligne en capitales : un seul mot de préférence (son quartier, sa rue, sa ville, ou le mot de son nom qui la distingue : « Farine » pour « Maison Farine »), plus il est court plus il est grand",
      max: 12,
      required: true,
    },
  ],
  objects: [
    {
      slot: "decor",
      shot: 0,
      want: "ce qui monte dans le bas du titre sur ce plan large et passe devant lui : ses toits, des immeubles, un clocher, un lampadaire, son enseigne, des arbres, des collines ; « every building », « every rooftop », « every tree » quand il y en a plusieurs (ils blanchissent un à un), sinon un seul nom (« skyline », « hills », « street lamp »)",
    },
    {
      slot: "morceaux",
      shot: 5,
      want: "ce qui se répète dans ce plan et peut blanchir pièce par pièce : « every window », « every lamp », « every jar », « every cup », « every chair », « every bottle » ; rien si rien ne s'y répète",
    },
    { slot: "enseigne", shot: 7, want: "son enseigne, son nom en grandes lettres, un néon, le nom peint sur sa vitrine (« shop sign », « neon sign », « painted window lettering ») : il clignote en blanc" },
    {
      slot: "cadres",
      shot: 9,
      want: "ce qui se répète sur le mur de ce plan, derrière le gros objet du premier plan : « every frame », « every poster », « every shelf », « every plate » ; rien si le mur est nu",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : horizontal 4:3 comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme ses vidéos (horizontal si la plupart le sont)" },
        { value: "horizontal", says: "horizontal 4:3 sur du noir, comme l'original" },
        { value: "vertical", says: "vertical plein écran" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/titre-derriere.md, effect 11): warm and contrasted, without the grain nor the dark
  // corners of the catalogue's « Ciné chaud », which the original does not show.
  finish: { contrast: 0.16, warmth: 0.12, grain: 0, vignette: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const count = Math.max(14, Math.min(LONG, n));
    // Its burst takes the shots past its eleven sections and its last (the original: eleven), then bars before it.
    const burst = Math.min(BURST_MOST, count - 12);
    const extra = Math.max(0, count - 12 - BURST_MOST);
    const phrases = [...Array.from({ length: Math.floor(extra / 2) }, () => PHRASE).flat(), ...(extra % 2 ? [BAR] : [])];
    const bars = Math.ceil(extra / 2) * BAR;
    const burstAt = 14 + bars;
    // Its last shot to just after the snare of beat 16,5 (with an ending card, whole bars of two beats longer).
    const card = end ? 2 * Math.ceil(END_CARD / (2 * beat) - 1e-6) : 0;
    const last = ENDS + bars - burstAt - burst * BURST + card;
    const beats = [TITLE, CALM, ...FLASHES, WHEEL, TURN, SIGN, DOOR, WALL, BACKLIT, ...phrases, ...Array.from({ length: burst }, () => BURST), last];
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const wants = [
      "le plan large et fixe qui ouvre, le téléphone posé, 4 s au moins : sa rue, son quartier, sa devanture, ou un paysage quand ça a du sens, avec du ciel ou un mur dégagé en haut et des choses qui y montent (toits, enseigne, lampadaire, arbres, collines), quelqu'un qui entre par un côté et marche en bas de l'image : son titre géant s'y pose derrière le décor",
      "un plan moyen et calme : quelqu'un qui regarde au loin, qui boit, qui respire (la musique s'arrête dessus)",
      ...FLASHES.map(() => "un plan éclair : un détail, une enseigne, un geste"),
      "un plan fixe où une même chose se répète (lampes, bocaux, tasses, chaises, fenêtres) avec quelque chose au milieu : elles blanchissent une à une",
      "quelqu'un qui marche, filmé en tournant autour de lui, ou un plan qui bouge vite",
      "son enseigne ou son nom en grand, fixe : il clignote en blanc",
      "un plan qui avance vers sa porte ou son entrée",
      "un mur garni (cadres, affiches, étagères) avec un gros objet devant (vélo, comptoir, machine, voiture), fixe, 2 s : les cadres blanchissent un à un, l'objet flashe en blanc",
      "quelqu'un en contre-jour devant une fenêtre, une boisson à la main, à peu près au milieu de l'image : sa silhouette blanche l'annonce sur le plan d'avant (la musique s'arrête dessus)",
      ...phrases.map((b) => (b < 2 ? "un plan calme de son lieu : quelqu'un qui regarde, qui boit, un geste lent (la musique s'arrête dessus)" : "un plan de son lieu ou de son quartier, tenu : du monde, ses gestes, ses produits")),
      ...Array.from({ length: burst }, () => "un plan très court en rafale : un nom écrit de son quartier (une plaque de rue, une enseigne, une ardoise), un détail, des gens"),
      "le dernier plan, court : quelqu'un de près devant une vue",
    ];
    // Its music: silent until beat 2 but for the whoosh and the hit the title lands on (the original's song starts on
    // its hit and stops at once), then stopped dead one beat in every bar (5, 9, 13 …: Tristan, of its originals'
    // pauses: « oui pourquoi pas si c'est bien fait »), cut dead with the picture.
    const pauses = [{ from: 0, to: round3(2 * beat) }];
    for (let b = 5; b * beat < duration - 0.05; b += BAR) pauses.push({ from: round3(b * beat), to: round3(Math.min(duration, (b + 1) * beat)) });
    const hit = toFrame(HIT * beat);
    const cut = spans[1]!.start;
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      // Its title rises from two images before the hit, its small words from the hit; both go with the cut.
      texts: {
        surtitre: { from: round(hit / 30), to: cut },
        titre: { from: round((hit - 2) / 30), to: cut },
      },
      marks: {
        hit,
        chase: toFrame(CHASE * beat) + 1,
        wave: toFrame(WAVE * beat),
        pieces: toFrame(PIECES * beat),
        flash: toFrame(FLASH * beat),
        ghost: toFrame(GHOST * beat),
      },
      music: { pauses, end: { at: duration } },
      // The low whoosh that rises into the hit the title lands on, and the one dry knock in the third stop as the door's
      // picture settles (the original's 6,96 s).
      sounds: [
        { at: round3(HIT * beat), sound: "low whoosh rising into a deep bass hit", seconds: 1, gain: 2 },
        { at: round3(KNOCK * beat), sound: "single dry drum hit", seconds: 0.5 },
      ],
    };
  },
  code: CODE,
  // Its small words are always in its fine pen hand, whatever her charter's fonts.
  fonts: ["Nothing You Could Do"],
};
