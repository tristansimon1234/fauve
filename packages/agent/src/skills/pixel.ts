import { END_CARD_SECONDS, beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Recette cosy, typo pixel », version 2, written again on its original's fiche (docs/fiches/pixel.md: measured image
// by image at 30 i/s, its texts read pixel by pixel, its music and its sounds measured, the video watched and heard by
// Gemini; Tristan: « c'est un effet que l'on veut pouvoir faire, pas exactement reproduire l'image »). Its music is a
// soft solo piano at 100 BPM (Gemini heard a lo-fi beat at 85, v1 played 84), and every length below is in its beats,
// so its cuts fall where the original's do (within an image) on its own music; they do not fall on its beats: the
// original cuts when a gesture ends. A recipe filmed from a fixed phone, each step from one place in short gestures,
// cut one after the other (15 of its 25 cuts in the same frame: the decor stays, only the gesture changes):
//   0 – 3,47     her finished result, its last touches in two gestures; on image 5 (before the first note) its title in
//                pixels lands at once, pale mint with a thin dark grey-green edge, on two centred lines in the upper
//                third (where her shot is calmest), a little face « (๑˃ᴗ˂) » raised before it, an outlined star after it;
//                two tiny typewriter lines (« comfort food » on the left, « perfect for cold days » low on the right)
//                and her name very small at the top, where the original had its own account's @ (never copied); then
//                the same result tasted or touched, four gestures, the title still on it, gone with the cut;
//   3,47 – 14,13 her steps, each with its tiny caption in a plain sans set on its first cut and gone with its last: the
//                first step in three gestures (what is prepared, named), the longest in six (what goes in, a list on
//                two lines), a gesture by hand with a little face « (´•ω•`) » alone at the middle, the cooking from three
//                places with two pairs of outlined stars in opposite corners, nearly ready (« smells so good! »);
//   14,13 – 15,53 the loop: her first video again, just before its first image (the last gesture before the result),
//                its closing word; no card, no black: Instagram plays it again and it leads into the result.
// Everything trembles, six times a second: every 5 images from its own arrival, each letter, each star and each face is
// drawn again with its own small tilt and a shift of a pixel or two (its first pose straight); nothing blinks, nothing
// lights up, nothing moves on her shots (no zoom, no push: the phone is posed). Its piano rests a beat in the first step
// and comes back on the downbeat, plays without its bass until the cooking (its bass comes in there), and stops dead
// with the last image as it loops; no sound effect: the original has none (its knife and its boiling water are its
// videos' own). Its format follows her videos (Tristan: « format par défaut [comme ses vidéos], et changement à la
// demande du user »): the whole vertical frame as the original, horizontal 16:9 on black when most of them are in
// width, or on her word. Her photos stay still, her videos play. No grain, no dark corners, no lifted blacks.

const BPM = 100;
/** Images a beat of its music at its own tempo: its gestures are measured in them. */
const IMAGES_A_BEAT = 18;
/**
 * Its sections as its original cuts them (docs/fiches/pixel.md), each gesture's length in images at its own tempo: its
 * result (the title over it), the same tasted, its first step (its first caption), its longest (its second, a list), a
 * gesture by hand (the little face), the cooking from three places (the stars), nearly ready and served (its third
 * caption), the loop (its closing word).
 */
const SECTIONS = [[16, 24], [13, 17, 16, 18], [9, 14, 23], [25, 11, 16, 14, 14, 15], [12, 15], [12, 12], [27], [15, 13, 14], [21], [38], [42]];
/** Fewer shots: these gestures go first ([section, gesture]); every place keeps one, its steps with words enough to be read. */
const DROP: [number, number][] = [[3, 1], [7, 1], [1, 0], [2, 0], [5, 1], [4, 0], [3, 3], [7, 2], [1, 2], [3, 4], [1, 3]];
const MOST = SECTIONS.flat().length;
const FEWEST = MOST - DROP.length;
/** Its sections by what they carry. */
const CUT = 2;
const FILL = 3;
const HAND = 4;
const COOK = 5;
const NEAR = 8;
const LOOP = 10;
/** Its title lands on image 5 of its first shot, before its music's first note. */
const TITLE_AT = 5;
/** Every text and drawing is drawn again every this many images (6 times a second). */
const BOIL = 5;
/** The engine's ending card (an option: the original has none): the Reel's last 2,5 s, its loop held whole beats longer for it. */
const END_CARD = END_CARD_SECONDS;
const onFrame = (s: number) => Math.round(s * 30) / 30;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its gestures for n shots (images at its own tempo), by section: the original's 26, fewer by DROP, never under 15. */
export function pixelSections(n: number): number[][] {
  const count = Math.max(FEWEST, Math.min(MOST, Math.round(n)));
  const dropped = DROP.slice(0, MOST - count);
  return SECTIONS.map((gestures, k) => gestures.filter((_, j) => !dropped.some(([s, g]) => s === k && g === j)));
}

/**
 * Its rest, a beat long, in its first step (from its first cut to its last, in beats of its music): back on the latest
 * downbeat it can (a bar of four), else the latest beat; none in a step shorter than a beat.
 */
export function pixelRest(from: number, to: number): number | null {
  const first = Math.ceil(from + 1 - 1e-6);
  const last = Math.floor(to + 1e-6);
  if (last < first) return null;
  for (let d = last; d >= first; d--) if (d % 4 === 0) return d;
  return last;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const n = shots.length;
  const cur = shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0);
  // Its sections (frames: its timeline's marks, its original's at 100 BPM by default): its first step, its longest, a
  // gesture by hand, the cooking, nearly ready, the loop.
  const CUT = mark("cut", 104);
  const FILL = mark("fill", 150);
  const HAND = mark("hand", 245);
  const COOK = mark("cook", 272);
  const NEAR = mark("near", 365);
  const LOOP = mark("loop", 424);
  const BOIL = Math.max(1, Math.round(mark("boil", 5)));
  const endAt = end ? end.from : durationInFrames + 1;

  // Its frame: the whole vertical frame, as the original; horizontal 16:9 on black when most of her videos are in width
  // (or she asks). Every place below is a share of it, its type a little smaller in the 16:9 one.
  const format = setting("format", "vertical");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: 0, width: bw, height: bh };
  const X = (p) => Math.round(bw * p);
  const Y = (p) => Math.round(bh * p);
  const S = wide ? 0.66 : 1;
  const px = (v) => Math.max(20, Math.round(v * (wide ? 0.86 : 1)));

  // Its three faces: its title in pixels (her display font: Pixelify Sans in its pair), its first tiny lines in a
  // typewriter (Courier Prime, the closest to the original's), its steps' captions in a plain sans (Inter). Its title
  // pale mint with a thin dark grey-green edge all round and no shadow; its tiny lines and drawings white, with a tight
  // dark edge of their own that a dark ground never shows (on a light one they still read).
  const pixel = "'" + brand.displayFont + "', monospace";
  const typewriter = "'Courier Prime', '" + brand.bodyFont + "', monospace";
  const plain = "'Inter', '" + brand.bodyFont + "', 'Helvetica Neue', Arial, sans-serif";
  const MINT = "#d4f7e9";
  const EDGE = "#2c4741";
  const CREAM = "#fff8e8";
  const e = Math.max(1, Math.round(2 * S));
  const titleEdge = [[e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, e], [e, -e], [-e, -e]].map((d) => d[0] + "px " + d[1] + "px 0 " + EDGE).join(", ");
  const thin = "0 0 1px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.3)";
  const drop = "drop-shadow(0 0 1px rgba(0,0,0,0.7)) drop-shadow(0 0 3px rgba(0,0,0,0.35))";
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const plainWords = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

  // 1. Everything trembles, six times a second: every BOIL images from its own arrival, each letter (each star, each
  // little face) is drawn again with its own small tilt, 2 to 6 degrees mostly (10 at most), and a shift of a pixel or
  // two, held until the next; its first pose straight. Nothing blinks, nothing lights up.
  const graphemes = (s) => (typeof Intl !== "undefined" && Intl.Segmenter ? Array.from(new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s), (x) => x.segment) : Array.from(s));
  const wobble = (seed, since) => {
    const k = Math.floor(since / BOIL);
    if (!(k >= 1)) return undefined;
    const r = (x) => random(x + k + "-" + seed + "-pixel");
    const deg = (r("s") < 0.5 ? -1 : 1) * (2 + 4 * r("a") + (r("b") > 0.9 ? 4 * r("c") : 0));
    const dx = (r("x") * 2 - 1) * 2 * S;
    const dy = (r("y") * 2 - 1) * 2 * S;
    return "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px) rotate(" + deg.toFixed(1) + "deg)";
  };
  // A text laid out whole from its arrival, word by word (never broken inside one), each letter trembling on its own.
  const boiled = (text, seed, since) => String(text).split(/([ \t\n]+)/).map((w, i) =>
    !w || /^[ \t\n]+$/.test(w)
      ? w
      : h("span", { key: i, style: { whiteSpace: "nowrap" } },
          graphemes(w).map((c, j) => h("span", { key: j, style: { display: "inline-block", transform: wobble(j + "-" + i + "-" + seed, since) } }, c))));

  // Its drawings, white and thin, decor: the little face before its title, the shy one alone on a gesture by hand, an
  // outlined star.
  const line = (w) => ({ fill: "none", stroke: "#ffffff", strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });
  const happy = (w) => h("svg", { width: w, height: Math.round(w / 3), viewBox: "0 0 90 30", style: { display: "block", overflow: "visible", filter: drop } },
    h("g", line(2.4),
      h("path", { d: "M7 1 Q1 15 7 29" }),
      h("path", { d: "M23 13 Q23 8 18.5 8 Q14 8 14 13.5 Q14 19 19 19 Q23.5 19 23 15 Q22.5 12.5 19.5 13.5" }),
      h("path", { d: "M29 9 L35 12.5 L29 16" }),
      h("path", { d: "M39 13 Q39 21 45.5 21 Q52 21 52 13" }),
      h("path", { d: "M62 9 L56 12.5 L62 16" }),
      h("path", { d: "M71 1 Q77 15 71 29" })));
  const shy = (w) => h("svg", { width: w, height: Math.round((w * 30) / 110), viewBox: "0 0 110 30", style: { display: "block", overflow: "visible", filter: drop } },
    h("g", line(2.4),
      h("path", { d: "M7 1 Q1 15 7 29" }),
      h("path", { d: "M17 8 L23 3" }),
      h("path", { d: "M40 13 Q40 21 46.5 21 Q53 21 53 14 Q53 21 59.5 21 Q66 21 66 13" }),
      h("path", { d: "M83 3 L89 8" }),
      h("path", { d: "M103 1 Q109 15 103 29" })),
    h("circle", { cx: 30, cy: 14, r: 3.4, fill: "#ffffff" }),
    h("circle", { cx: 76, cy: 14, r: 3.4, fill: "#ffffff" }));
  const star = (s) => h("svg", { width: s, height: s, viewBox: "0 0 40 40", style: { display: "block", overflow: "visible", filter: drop } },
    h("path", { d: "M20 2.5 L24.9 14.6 L37.8 15.3 L27.8 23.5 L31.1 36 L20 28.9 L8.9 36 L12.2 23.5 L2.2 15.3 L15.1 14.6 Z", ...line(2.2) }));
  const decor = (key, x, y, child, since) => h("div", { key, "data-fauve-decor": "", style: { position: "absolute", left: x, top: y, transform: wobble(key, since) } }, child);
  // Two outlined stars, a small one and a larger one on a rising diagonal, each trembling on its own.
  const pair = (key, x, y, big, small, since) =>
    h("div", { key, "data-fauve-decor": "", style: { position: "absolute", left: x, top: y, width: Math.round(small * 0.9 + big), height: Math.round(big + small * 0.4) } },
      h("div", { style: { position: "absolute", left: 0, top: Math.round(big - small * 0.6), transform: wobble("a-" + key, since) } }, star(small)),
      h("div", { style: { position: "absolute", left: Math.round(small * 0.9), top: 0, transform: wobble("b-" + key, since) } }, star(big)));

  // 2. Her shots full frame in its frame, as filmed: a video plays, a photo stays still; nothing zooms nor moves.
  const film = n ? h(Footage, { key: "shot", shot: cur, style: { left: 0, top: 0, width: bw, height: bh } }) : null;

  const hook = reelTexts.find((t) => t.role === "hook");
  const band = reelTexts.find((t) => t.role === "band");
  const captions = reelTexts.filter((t) => t.role === "caption");
  const opening = captions.find((t) => t.from < CUT) || null;
  const closing = captions.find((t) => t !== opening && t.from >= CUT) || null;
  const others = reelTexts.filter((t) => t !== hook && t !== band && t !== opening && t !== closing);
  const shown = (t) => Boolean(t) && frame >= t.from && frame < t.to && frame < endAt;

  // 3. Its title in pixels on her result and on it tasted, at once on image 5, nothing typed nor lit, gone with the
  // cut: in lower case on two lines balanced by their letters, 89 px (the original's letters, its lines 5,5 % of the
  // frame apart), centred, set on the calmest part of the upper third of her result (her dark worktop, a plain wall,
  // at its size or nearly), else at the original's place (centred at 34 % of the height); its little face raised before
  // its first letter and its star after its last, outside its centred lines.
  const TITLE = Math.round(89 * S);
  const TW = Math.round(bw * 0.72);
  const TH = Math.round(TITLE * 1.19) * 2 + Math.round(TITLE * 0.36);
  const middle = { x: Math.round((bw - TW) / 2), y: Y(0.343) - Math.round(TH / 2), w: TW, h: TH };
  let titleBlock = null;
  if (shown(hook)) {
    const spot = ClearBox(shots[0], frame, laid, { aspect: TW / TH, min: { w: Math.round(TW * 0.85), h: Math.round(TH * 0.85) }, max: { w: TW, h: TH }, sky: false, within: { x: X(0.08), y: Y(0.155), w: X(0.84), h: Y(0.315) }, origin: { x: 0, y: by }, pad: 6, fallback: middle }) || middle;
    const since = frame - hook.from;
    const size = Math.round(TITLE * Math.min(1, spot.h / TH, spot.w / TW));
    const words = keep(hook.text).split(/[ \t\n]+/).filter(Boolean);
    let split = 1;
    for (let k = 1, best = Infinity; k < words.length; k++) {
      const longest = Math.max(words.slice(0, k).join(" ").length, words.slice(k).join(" ").length);
      if (longest < best) { best = longest; split = k; }
    }
    const lines = words.length > 1 ? [words.slice(0, split).join(" "), words.slice(split).join(" ")] : [words.join(" ")];
    const face = h("span", { key: "face", "data-fauve-decor": "", style: { display: "inline-block", position: "relative", width: 0, height: 0, verticalAlign: "top" } },
      h("span", { style: { position: "absolute", right: Math.round(size * 0.14), top: -Math.round(size * 0.06), transform: wobble("face", since) } }, happy(Math.round(size * 0.92))));
    const after = h("span", { key: "star", "data-fauve-decor": "", style: { display: "inline-block", position: "relative", width: 0, height: 0 } },
      h("span", { style: { position: "absolute", left: Math.round(size * 0.31), top: -Math.round(size * 0.56), transform: wobble("star", since) } }, star(Math.round(size * 0.53))));
    titleBlock = h(FitText, { key: "title", style: { position: "absolute", left: Math.round(spot.x), top: Math.round(spot.y), width: Math.round(spot.w), height: Math.round(spot.h) }, innerStyle: { fontFamily: pixel, fontWeight: 500, fontSize: size, lineHeight: 1.19, color: MINT, textShadow: titleEdge, textAlign: "center" } },
      h("div", null, lines.map((l, i) => h("div", { key: i, style: { whiteSpace: "nowrap" } }, i === 0 ? face : null, boiled(l, "title-" + i, since), i === lines.length - 1 ? after : null))));
  }

  // 4. With the title, her name very small at the top, in the typewriter, where the original had its own account's @
  // (its account never copied); none when her title is her name.
  const name = String(brand.name || "").trim().toLowerCase();
  const handle = shown(hook) && name && plainWords(name) !== plainWords(hook.text)
    ? h(FitText, { key: "name", style: { position: "absolute", left: X(0.25), top: Y(0.124), width: X(0.5), height: Math.round(px(22) * 1.7) }, innerStyle: { fontFamily: typewriter, fontWeight: 400, fontSize: px(22), lineHeight: 1.2, color: CREAM, textShadow: thin, whiteSpace: "nowrap" } },
        h("span", { "data-fauve-accent": "" }, boiled(name, "name", frame - hook.from)))
    : null;

  // A tiny line in a box (shares of its frame), aligned on its side: the typewriter of the first lines, or the plain
  // sans of the captions; 30 px, a short label beside a title that reads.
  const tiny = (key, text, box, align, face, since) => h(FitText, { key, style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h }, innerStyle: { alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center", textAlign: align, fontFamily: face, fontWeight: face === plain ? 500 : 400, fontSize: px(face === plain ? 29 : 30), lineHeight: 1.3, color: face === plain ? "#ffffff" : CREAM, textShadow: thin, whiteSpace: "nowrap" } },
    h("span", { "data-fauve-accent": "" }, boiled(keep(text), key, since)));

  // 5. Its two tiny typewriter lines with the title, its words cut at their comma: the first on the left at mid-height
  // (on the rim of the original's bowl), the second low on the right, just above the apps' caption (at 75 % in the
  // original, lifted).
  let openingLines = null;
  if (shown(opening)) {
    const m = /^(.*?\S)(\s*[,\/;]\s*)(\S.*)$/.exec(String(opening.text));
    const parts = m ? [m[1], m[2], m[3]] : [String(opening.text), "", ""];
    const since = frame - opening.from;
    openingLines = h("div", { key: "opening" },
      tiny("o1", parts[0], { x: X(0.136), y: Y(0.513), w: X(0.52), h: Y(0.032) }, "left", typewriter, since),
      parts[1] ? h("span", { style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, parts[1]) : null,
      parts[2] ? tiny("o2", parts[2], { x: X(0.3), y: Y(0.71), w: X(0.522), h: Y(0.032) }, "right", typewriter, since) : null);
  }

  // 6. Its steps' captions, her words between « / » in their order, each on its step from its first cut to its last:
  // the first on the first step (upper left, the name of what is prepared), the second on the longest (two centred
  // lines under what is prepared, lifted above the apps' caption), the third once nearly ready (upper left, what it
  // smells like), a fourth on the gesture by hand and a fifth on the cooking (in place of the little face and the stars),
  // any more with the third. Every one is in the page all along (her separators too), only the current one seen.
  let steps = null;
  const told = [];
  if (band && frame >= band.from && frame < Math.min(band.to, endAt)) {
    const text = String(band.text);
    const parts = /[\/|\n]/.test(text) ? text.split(/(\s*[\/|\n]\s*)/) : [text];
    const items = [];
    parts.forEach((p, i) => { if (i % 2 === 0 && p.trim()) items.push(i); });
    const WINDOWS = [[CUT, FILL], [FILL, HAND], [NEAR, LOOP], [HAND, COOK], [COOK, NEAR]];
    const two = (s) => {
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length < 4) return [s];
      const half = s.length / 2;
      let best = -1;
      for (let i = s.indexOf(","); i >= 0; i = s.indexOf(",", i + 1)) if (best < 0 || Math.abs(i - half) < Math.abs(best - half)) best = i;
      if (best > 0 && best < s.length - 2) return [s.slice(0, best + 1).trim(), s.slice(best + 1).trim()];
      const k = Math.ceil(words.length / 2);
      return [words.slice(0, k).join(" "), words.slice(k).join(" ")];
    };
    steps = h("div", { key: "steps" },
      parts.map((p, i) => {
        const k = items.indexOf(i);
        if (k < 0) return h("span", { key: "s" + i, style: { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1 } }, p);
        const w = k < 5 ? WINDOWS[k] : WINDOWS[2];
        const on = frame >= w[0] && frame < w[1];
        if (k < 5) told[k] = true;
        const since = frame - w[0];
        const words = p.trim();
        const extra = Math.max(0, k - 4);
        if (k === 1) {
          const lines = two(words);
          return h("div", { key: "c" + i, style: { opacity: on ? 1 : 0 } },
            lines.map((l, j) => tiny("c" + i + "-" + j, l, { x: X(0.12), y: Y(lines.length > 1 ? 0.672 : 0.69) + j * Y(0.033), w: X(0.76), h: Y(0.032) }, "center", plain, since)));
        }
        const box = k === 3 ? { x: X(0.2), y: Y(0.484), w: X(0.6), h: Y(0.032) } : k === 4 ? { x: X(0.12), y: Y(0.192), w: X(0.7), h: Y(0.032) } : k === 0 ? { x: X(0.254), y: Y(0.312), w: X(0.62), h: Y(0.032) } : { x: X(0.208), y: Y(0.3) + extra * Y(0.034), w: X(0.66), h: Y(0.032) };
        return h("div", { key: "c" + i, style: { opacity: on ? 1 : 0 } }, tiny("c" + i, words, box, k === 3 ? "center" : "left", plain, since));
      }));
  }

  // 7. A step without words: on the gesture by hand, the shy little face alone at the middle (it does not follow what is
  // there); over the cooking, from its first place to its last, two pairs of outlined stars in opposite corners.
  const shyFace = !told[3] && frame >= HAND && frame < COOK && frame < endAt ? decor("shy", X(0.454), Y(0.492), shy(Math.round(98 * S)), frame - HAND) : null;
  const stars = !told[4] && frame >= COOK && frame < NEAR && frame < endAt
    ? h(React.Fragment, { key: "stars" },
        pair("st1", X(0.125), Y(0.185), Math.round(48 * S), Math.round(30 * S), frame - COOK),
        pair("st2", X(0.762), Y(0.723), Math.round(38 * S), Math.round(24 * S), frame - COOK))
    : null;

  // 8. On the loop, its closing word, upper left where the third caption was.
  const closingLine = shown(closing) ? tiny("fin", closing.text, { x: X(0.2), y: Y(0.3), w: X(0.66), h: Y(0.032) }, "left", plain, frame - closing.from) : null;

  // 9. Its ending card, only when the Reel has one (an option: the original ends on its loop): the last image softly
  // darkened, its title in the title's pixels with its star, a typewriter line under it, trembling as the rest.
  const veil = interpolate(frame, [endAt, endAt + 8], [0, 1], clamp);
  const ending = end && frame >= endAt
    ? h(React.Fragment, { key: "end" },
        h("div", { style: { position: "absolute", left: 0, top: 0, width: bw, height: bh, background: "linear-gradient(180deg, rgba(20,12,6," + (0.5 * veil).toFixed(3) + ") 0%, rgba(20,12,6," + (0.38 * veil).toFixed(3) + ") 60%, rgba(20,12,6," + (0.24 * veil).toFixed(3) + ") 100%)" } }),
        h(FitText, { style: { position: "absolute", left: X(0.13), top: Y(0.3), width: X(0.74), height: Math.round(TH * 0.92) }, innerStyle: { fontFamily: pixel, fontWeight: 500, fontSize: TITLE, lineHeight: 1.19, color: MINT, textShadow: titleEdge, textAlign: "center", textWrap: "balance" } },
          h("span", null, boiled(keep(end.title), "end", frame - endAt),
            h("span", { "data-fauve-decor": "", style: { display: "inline-block", position: "relative", width: 0, height: 0 } },
              h("span", { style: { position: "absolute", left: Math.round(TITLE * 0.31), top: -Math.round(TITLE * 0.56), transform: wobble("end-star", frame - endAt) } }, star(Math.round(TITLE * 0.53)))))),
        end.subtitle
          ? h(FitText, { style: { position: "absolute", left: X(0.13), top: Y(0.3) + Math.round(TH * 0.98), width: X(0.74), height: 125 }, innerStyle: { justifyContent: "flex-start", fontFamily: typewriter, fontWeight: 400, fontSize: 48, lineHeight: 1.25, color: CREAM, textShadow: thin, textAlign: "center", textWrap: "balance" } },
              h("span", null, boiled(keep(end.subtitle), "end-line", frame - endAt)))
          : null)
    : null;

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } },
    film, titleBlock, handle, openingLines, steps, shyFace, stars, closingLine, ending);

  // Any other text of the Reel (none in its slots): a plain white line at the top of its frame, so nothing she wrote is lost.
  const extra = others.filter((t) => shown(t)).map((t, i) =>
    h(FitText, { key: "x" + i, style: { position: "absolute", left: 140, width: width - 280, top: wide ? Math.max(100, by - 150 - i * 120) : 170 + i * 130, height: 110 }, innerStyle: { fontFamily: plain, fontWeight: 600, fontSize: 50, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: thin } }, keep(t.text)));

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, extra);
}`;

/** What each place's first shot wants (for the filler); its next ones are the same video's next gestures. */
const FIRST = [
  "son résultat fini en gros plan, vu de dessus ou de face, le téléphone posé, à la lumière chaude, le tiers haut de l'image sombre ou uni (le titre s'y pose) : une main y pose une dernière touche (une herbe, un fruit, du sucre glace) ; cette vidéo revient à la fin",
  "le même résultat de biais, qu'on goûte ou qu'on touche (une cuillère, une fourchette, une main, une poche à douille), le téléphone posé : un geste",
  "la première étape, filmée d'un seul endroit, le téléphone posé : on coupe, on casse, on pèse ce qu'on prépare (sa toute petite légende le nomme) ; son premier geste",
  "l'étape la plus longue, d'un seul endroit, vue de dessus si possible : ce qui va dedans, un ingrédient après l'autre (sa toute petite légende les nomme) ; son premier geste",
  "un geste doux à la main, d'un seul endroit : façonner, plier, mélanger, garnir (un petit visage s'y pose)",
  "la cuisson, l'attente ou le montage, d'un seul endroit : la casserole, le four, le moule, le gâteau qu'on monte (des étoiles s'y posent)",
  "la même étape d'un autre endroit : ce qu'on y verse ou ce qu'on y ajoute",
  "la même étape encore, d'un autre endroit, en quelques gestes",
  "presque prêt, de plus près : ce qui cuit, ce qui fume, ce qui prend forme (sa toute petite légende dit ce que ça sent ou ce qu'on ressent)",
  "on finit, on sert ou on prend une part, de plus près : une louche, une cuillère, une spatule, un couteau",
  "la même vidéo que la case 1, juste avant elle : le dernier geste avant le résultat (verser, poser la dernière touche) ; la fin rejoint le début, la boucle",
];
const NEXT = "la même vidéo que la case précédente, juste après : le geste suivant de cette étape (sans les temps morts entre eux)";

export const pixel: MontageSkill = {
  key: "pixel",
  // 2: written again on its original's fiche: its tempo (100) and its gestures cut one after the other in the same
  // frame (26 shots, its cuts within an image), its title in pixels at once (mint, a thin dark edge, no shadow), its
  // tiny typewriter lines and her name small, its captions in a plain sans step by step, its little faces and its
  // stars, everything trembling every 5 images, its loop instead of a card, its music's rest, its bass that comes in on
  // the cooking and its dead stop, its format, a finish without grain, dark corners nor lifted blacks.
  // 3: vertical full frame by default, her horizontal files cropped on their subject, its band only when she asks for
  // it (Tristan, 6 November, on seven benches: « vertical please », « tout vertical please »).
  version: 3,
  bpm: BPM,
  shots: [FEWEST, MOST],
  files: [4, 12],
  how: "Une recette filmée le téléphone posé, geste par geste : son résultat fini ouvre le Reel, deux dernières touches, avec un titre en pixels doux vert d'eau sur deux lignes au tiers haut (un petit visage devant, une étoile après), deux toutes petites lignes en machine à écrire et son nom en tout petit ; le même qu'on goûte ou qu'on touche, quatre gestes ; puis chaque étape d'un seul endroit en gestes courts coupés l'un après l'autre dans le même plan (la première en trois, la plus longue en six : chaque étape est une seule de ses vidéos, ses cases suivantes la même vidéo un peu plus loin), chacune avec sa toute petite légende, un petit visage sur un geste à la main, des étoiles dans les coins pendant la cuisson ; tout tremble légèrement six fois par seconde ; la fin est sa première vidéo juste avant le résultat, et le Reel boucle. Un piano doux qui se tait un temps et dont la basse arrive sur la cuisson.",
  end: true,
  texts: [
    {
      slot: "titre",
      role: "hook",
      want: "le titre en pixels sur son résultat fini, en minuscules, qui tient sur deux lignes : ce qu'elle prépare, court, avec « !! » à la fin (une forme comme « soupe de saison!! », « gâteau fraise menthe!! »)",
      max: 24,
      required: true,
    },
    {
      slot: "petit_mot",
      role: "caption",
      want: "deux toutes petites lignes en machine à écrire, séparées par une virgule, en minuscules, 2 à 4 mots chacune : ce que c'est, puis pour qui ou pour quand (une forme comme « fait maison, pour les soirs froids »)",
      max: 44,
      required: true,
    },
    {
      slot: "etapes",
      role: "band",
      want: "trois toutes petites légendes séparées par « / », en minuscules, dans l'ordre : ce qu'on prépare à la première étape (1 ou 2 mots), ce qu'on ajoute à la plus longue (une liste de 4 à 8 mots), puis ce que ça sent ou ce qu'on ressent juste avant la fin (2 à 4 mots) (une forme comme « les œufs / farine, sucre, beurre et vanille / ça sent bon ! »)",
      max: 100,
      required: true,
    },
    {
      slot: "fin",
      role: "caption",
      want: "le petit mot de la fin, sur la boucle, en minuscules, 2 ou 3 mots (une forme comme « bonne dégustation », « à demain matin »)",
      max: 24,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : vertical plein écran comme l'original, ou horizontal",
      choices: [
        { value: "vertical", says: "vertical plein écran comme l'original, ses vidéos en largeur recadrées sur leur geste" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, ses vidéos en largeur en entier", band: true },
        { value: "auto", says: "comme ses vidéos (vertical plein écran ; horizontal 16:9 sur du noir quand la plupart sont en largeur)" },
      ],
    },
  ],
  // Its original's grade (docs/fiches/pixel.md, effect 9): warm and dark, its blacks deep and never lifted, no moving
  // grain, no dark corners added (the catalogue's « Cosy » laid grain, corners and lifted blacks over everything).
  finish: { contrast: 0.08, grain: 0, vignette: 0, fade: 0 },
  timeline(n, options) {
    const { end } = options;
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const sections = pixelSections(n);
    // Each gesture in beats of its music; with an ending card, its loop held whole beats longer (the card's 2,5 s).
    const card = end ? Math.ceil(END_CARD / beat - 1e-6) : 0;
    const beats = sections.flatMap((gestures, k) => gestures.map((f, j) => f / IMAGES_A_BEAT + (k === sections.length - 1 && j === gestures.length - 1 ? card : 0)));
    const spans = beatSpans(bpm, beats);
    const duration = spans.at(-1)!.end;
    const firsts = sections.map((_, k) => sections.slice(0, k).reduce((a, g) => a + g.length, 0));
    const at = (k: number) => spans[firsts[k]!]!.start;
    const wants = sections.flatMap((gestures, k) => gestures.map((_, j) => (j === 0 ? FIRST[k]! : NEXT)));
    // Its title from image 5, before the first note; its tiny lines with it; both gone with the cut on its first step.
    const titleFrom = round(onFrame((TITLE_AT / IMAGES_A_BEAT) * beat));
    // Its piano rests a beat in its first step and comes back on the downbeat (the original's 4,25 – 4,75 s, back at
    // 4,8 s), plays without its bass until the cooking (its bass comes in on the beat before it: 8,98 s, three images
    // before the cut), and stops dead with the last image as the Reel loops (with an ending card, the mix fades it).
    const rest = pixelRest(at(CUT) / beat, at(FILL) / beat);
    const bass = Math.floor(at(COOK) / beat + 1e-6);
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: wants[i]! })),
      texts: {
        titre: { from: titleFrom, to: round(at(CUT)) },
        petit_mot: { from: titleFrom, to: round(at(CUT)) },
        etapes: { from: round(at(CUT)), to: round(at(LOOP)) },
        fin: { from: round(at(LOOP)), to: round(end ? duration - END_CARD : duration) },
      },
      music: {
        ...(rest !== null ? { pauses: [{ from: round3((rest - 1) * beat), to: round3(rest * beat) }] } : {}),
        filters: [{ kind: "thin", from: 0, to: round3(bass * beat) }],
        ...(end ? {} : { end: { at: duration } }),
      },
      marks: {
        cut: toFrame(at(CUT)),
        fill: toFrame(at(FILL)),
        hand: toFrame(at(HAND)),
        cook: toFrame(at(COOK)),
        near: toFrame(at(NEAR)),
        loop: toFrame(at(LOOP)),
        boil: BOIL,
      },
    };
  },
  code: CODE,
  fonts: ["Courier Prime", "Inter"],
};
