import type { EffectPiece, PieceTimeline } from "../pieces.ts";

// « Coulisses façon fiche », the effect (docs/fiches/coulisses.md, effects 1 to 3 and 5 to 9; its whole Reel is
// skills/coulisses.ts): for a moment, her shots become a creator's « sound effects breakdown ». The frame is a technical
// sheet on an electric blue squared ground, still from its first image to its last: a big bold title sitting on a card
// with rounded corners (her small words on its two ends, falling into place on the opening whoosh), her shots playing in
// the card, cut where the editor cut them, the name of each sound under the card as it is heard (« WHOOSH x2 »,
// « CHARGEMENT », « DÉCLENCHEUR », « DÉCLICS », « CLIC SOURIS »: changed at once with it, a count when it comes again
// within two thirds of a second, gone in a silence of more than a third of a second, the last one held), and the montage's timeline
// under it, its red playhead crossing it at a constant speed, her shots on its first video track and each sound a green
// clip where it is heard. On each cut under it, one of the original's moves on its sound (its timeline gives both, so
// the label, the picture and the sound agree): a whoosh; the next shot loading tile by tile over the shot before, a beep
// a jump (the card cut in 5 × 3 tiles, its second loading's pattern, or its first's over a long shot); a camera flash in
// the card; the cut that stutters between the two shots on six clicks; a double mouse click. Its last cut is always a
// whoosh, and what her last shot shows (a dish, a product in her hand, named by the filler) arrives cut out on the shot
// before, exactly in place, five images before it, as the original's pastries do. 16 sounds at most: a cut past them is
// cut in silence, the label gone, as the original's three are. The card is 16:9 as the original's when her shots are
// mostly horizontal, square otherwise (its « format »). Kept of its skill: its sheet and its proportions (within 1 % of
// the original), its sounds (the library's own words, made once for it), its patterns of tiles, flashes and stutters, in
// the original's images counted in beats. Left: its music-less soundtrack (the Reel's music plays under its sounds), its
// 28 slots and their casting, the title of her video in the card, its burst on a ratchet and its ending card.

/** Its cuts' moves, in its code's numbers (marks k1, k2…: what happens on each cut under it, in order). */
export const CUT = { silent: 0, whoosh: 1, flash: 2, load: 3, stutter: 4, mouse: 5 } as const;
/** The moves of its cuts but the last, in turn, in the original's order (its last cut is always a whoosh). */
const CYCLE = [CUT.load, CUT.flash, CUT.stutter, CUT.mouse, CUT.whoosh, CUT.flash, CUT.silent, CUT.load, CUT.stutter, CUT.whoosh, CUT.mouse, CUT.silent];
/** The sounds each move takes: a stutter's six clicks, one for the others, none in silence. */
const COST: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 6, 5: 1 };
/** The most sounds one effect plays (pieces.ts keeps 16). */
const MAX_SOUNDS = 16;
/** A loading shorter than this (frames) is a flash instead: the tiles would not be seen jumping. */
const LOAD_MIN = 12;
/** Its sounds, its skill's (the sound library's words, made once for it; the gain from the level of sound effects). */
const WHOOSH = { sound: "short air whoosh", seconds: 0.5, gain: 6 };
const TICK = { sound: "camera shutter click", seconds: 0.5, gain: -3 };
const DATA = { sound: "computer data processing beeps", gain: -3 };
const MOUSE = { sound: "computer mouse double click", seconds: 0.5 };
const SHUTTER = { sound: "camera shutter", seconds: 0.5, gain: 2 };
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its opening whoosh, as its small words fall into place (frames from its start: the original's image 4, in beats at 120 BPM). */
export const fallFrame = (beat: number) => Math.max(1, Math.round((4 * beat) / 15));

/** How long the next shot loads over the shot before (frames): its first loading's 55 images over a long shot, else its second's 28, within that shot. */
export function loadFrames(before: number, beat: number): number {
  const slow = Math.round((55 * beat) / 15);
  const fast = Math.round((28 * beat) / 15);
  const room = before - 2;
  return room >= 0.8 * slow ? Math.min(slow, room) : Math.min(fast, room);
}

/** The beeps under a loading (s): the library's one second, or its two for a long one. */
const beepSeconds = (load: number) => (load / 30 <= 1.4 ? 1 : 2);

/** How long each move's sound lasts after its cut (frames), as its code holds its label: a whoosh, a flash's shutter, a stutter's clicks, a double click. */
const TAIL: Record<number, number> = { 0: 0, 1: 9, 2: 10, 4: 7, 5: 5 };

/**
 * What happens on each cut under it (`shots`: its shots, frames from its start, in order): its move, in the original's
 * order, and a loading's length (over the end of the shot before, once the sound before it is over: never under another
 * sound's label); its last cut a whoosh; within its 16 sounds (the opening whoosh and the last cut's kept first: a
 * stutter past them is a whoosh, then a cut in silence).
 */
export function cutPlan(shots: { from: number; frames: number }[], beat: number): { at: number; kind: number; load: number }[] {
  const cuts = shots.slice(1).map((s, k) => ({ at: s.from, before: Math.min(shots[k]!.frames, shots[k]!.from + shots[k]!.frames) }));
  let used = 2;
  // The first frame no sound holds any more: after the opening whoosh, then after each cut's.
  let free = fallFrame(beat) + TAIL[CUT.whoosh]! + 1;
  return cuts.map((c, k) => {
    if (k === cuts.length - 1) return { at: c.at, kind: CUT.whoosh, load: 0 };
    let kind: number = CYCLE[k % CYCLE.length]!;
    const load = kind === CUT.load ? Math.min(loadFrames(c.before, beat), c.at - free) : 0;
    if (kind === CUT.load && load < LOAD_MIN) kind = CUT.flash;
    if (used + COST[kind]! > MAX_SOUNDS) kind = used + 1 <= MAX_SOUNDS ? CUT.whoosh : CUT.silent;
    used += COST[kind]!;
    free = kind === CUT.load ? c.at - load + Math.round(beepSeconds(load) * 30) : kind === CUT.silent ? c.at : c.at + TAIL[kind]! + 1;
    return { at: c.at, kind, load: kind === CUT.load ? load : 0 };
  });
}

/** Its sounds (s from its start), each on its move: the opening whoosh, then each cut's, as its code shows them. */
export function cutSounds(plan: { at: number; kind: number; load: number }[], beat: number): NonNullable<PieceTimeline["sounds"]> {
  const sounds: NonNullable<PieceTimeline["sounds"]> = [{ at: round3(fallFrame(beat) / 30), ...WHOOSH }];
  for (const c of plan) {
    if (c.kind === CUT.whoosh) sounds.push({ at: round3(c.at / 30), ...WHOOSH });
    if (c.kind === CUT.flash) sounds.push({ at: round3((c.at + 1.4) / 30), ...SHUTTER });
    if (c.kind === CUT.load) sounds.push({ at: round3((c.at - c.load) / 30), ...DATA, seconds: beepSeconds(c.load) });
    if (c.kind === CUT.stutter) for (let k = 0; k < 6; k++) sounds.push({ at: round3((c.at + k - 0.3) / 30), ...TICK });
    if (c.kind === CUT.mouse) sounds.push({ at: round3(c.at / 30), ...MOUSE });
  }
  return sounds;
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const num = (k, d) => { const v = Number(texts && texts[k]); return texts && texts[k] !== undefined && Number.isFinite(v) ? v : d; };
  // Its shots: those that play during it, in order, each in the card in its turn (one that only grazes it by a frame
  // left out, as the engine counts the shots under it: its marks name its cuts in that order).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames - 1 && shots[i].from + shots[i].durationInFrames > 1);
  if (!mine.length) return null;
  const BEAT = Math.max(1, num("beat", 18));
  const IMG = BEAT / 15;
  const WHITE = "#ffffff";
  const at = (i) => Math.round(shots[i].from);
  const cur = mine.reduce((k, i) => (shots[i].from <= frame ? i : k), mine[0]);

  // Its sheet, one block centred in the frame: the card 16:9 as the original's when most of its shots are horizontal
  // (or she asks), else square at the same width; the title sitting on the card, the label under it, the timeline under it.
  const format = word("format") || "auto";
  const wideShots = mine.filter((i) => (Number(shots[i].aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > mine.length);
  const CX = 132;
  const CW = 816;
  const CH = wide ? 459 : 816;
  const CY = wide ? 586 : 408;
  const LABEL_Y = CY + CH + 114;
  const TL_Y = CY + CH + 179;
  const box = { position: "absolute", left: 0, top: 0, width: CW, height: CH };
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Inter', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  // Capitals, as the sheet sets everything; an ordinal keeps its small letters (« PARIS 11e »).
  const caps = (s) => String(s || "").toUpperCase().replace(/(\d)(ER|E)\b/g, (m, d, x) => d + x.toLowerCase());

  // Its moves, one on each cut under it (its marks: k1, k2… what happens there, ld1… a loading's length), after its
  // opening whoosh (the sheet lands, her small words fall): a whoosh (1), a flash (2), the next shot loading tile by
  // tile (3), the cut that stutters (4), a double click (5), a cut in silence (0). Without its marks, whooshes.
  const FALL = Math.max(1, num("fall", Math.max(1, Math.round(4 * IMG))));
  const cuts = mine.slice(1).map((i, k) => {
    const kind = num("k" + (k + 1), 1);
    const load = kind === 3 ? Math.max(1, num("ld" + (k + 1), Math.round(28 * IMG))) : 0;
    return { i, prev: mine[k], at: at(i), kind, load };
  });
  // Each sound's moment, the frames its label shows from and its sound ends, as its timeline lays its sounds.
  const events = [{ kind: 1, at: FALL, start: Math.max(0, FALL - 4), end: FALL + 9, cut: null }];
  for (const c of cuts) {
    if (c.kind === 1) events.push({ kind: 1, at: c.at, start: c.at - 1, end: c.at + 9, cut: c });
    if (c.kind === 2) events.push({ kind: 2, at: c.at + 1, start: c.at - 1, end: c.at + 10, cut: c });
    if (c.kind === 3) events.push({ kind: 3, at: c.at - c.load, start: c.at - c.load, end: c.at - c.load + (c.load / 30 <= 1.4 ? 30 : 60), cut: c });
    if (c.kind === 4) events.push({ kind: 4, at: c.at, start: c.at - 1, end: c.at + 7, cut: c });
    if (c.kind === 5) events.push({ kind: 5, at: c.at, start: c.at - 2, end: c.at + 5, cut: c });
  }
  // The same sound again within two thirds of a second is one label, counted (« WHOOSH x2 »), as the original's
  // « WHOOSH x 2 » (its two whooshes a third of a second apart).
  const NAMES = ["", "WHOOSH", "DÉCLENCHEUR", "CHARGEMENT", "DÉCLICS", "CLIC SOURIS"];
  const groups = [];
  for (const e of events) {
    const g = groups[groups.length - 1];
    if (g && g.kind === e.kind && (e.kind === 1 || e.kind === 2 || e.kind === 5) && e.start - g.last <= 20) {
      g.count++;
      g.last = e.at;
      g.end = e.end;
      g.events.push(e);
    } else groups.push({ kind: e.kind, start: e.start, last: e.at, end: e.end, count: 1, events: [e] });
  }
  // Each label from its sound to the next one; gone 3 images after its sound in a silence of more than a third of a
  // second; the last one held to its end.
  const shownLabel = groups.findIndex((g, k) => {
    const next = groups[k + 1];
    const until = !next ? durationInFrames : next.start - g.end <= 10 ? next.start : g.end + 3;
    return frame >= g.start && frame < until;
  });

  // 1. In the card, her shot of the moment as filmed (a photo still, a video playing), cut where the editor cut it. The
  // cut that stutters: six images between the two shots, an image each, the new one first (its original's B B A B A B,
  // then B A B A A B), the old one holding its last image.
  let showing = cur;
  cuts.filter((c) => c.kind === 4).forEach((c, n) => {
    const pattern = n ? [1, 0, 1, 0, 0, 1] : [1, 1, 0, 1, 0, 1];
    const k = frame - c.at;
    if (k >= 0 && k < 6 && !pattern[k]) showing = c.prev;
  });
  const film = h(Footage, { key: "s" + showing, shot: showing, style: box });

  // The next shot loading tile by tile over the shot before, a beep a jump: the card cut in 5 × 3 tiles, a piece of the
  // shot to come, in place, jumping from tile to tile, then a few at once, then all of it at the cut; its picture held on
  // its first image until it plays. Over a long shot its first loading (in reading order, four at random, three blocks),
  // else its second, faster (the top row from right to left, then 2, 2, 2, 3, 8 and 11 tiles at once).
  const COLS = 5;
  const tw = CW / COLS;
  const th = CH / 3;
  const ONE = [0, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35].map((f, i) => [f / 55, [i]])
    .concat([[38 / 55, [7]], [40 / 55, [1]], [43 / 55, [12]], [45 / 55, [9]], [48 / 55, [0, 1, 2]], [50 / 55, [3, 4, 8, 9, 13, 14]], [53 / 55, [5, 6, 10, 11, 12]]]);
  const TWO = [[1, [4]], [3, [3]], [5, [2]], [8, [1]], [10, [0]], [13, [6, 13]], [15, [5, 9]], [18, [2, 11]], [20, [0, 8, 14]], [23, [1, 3, 4, 6, 7, 10, 12, 13]], [25, [0, 2, 5, 6, 8, 9, 10, 11, 12, 13, 14]]].map(([f, t]) => [f / 28, t]);
  const tiles = cuts.filter((c) => c.kind === 3 && frame >= c.at - c.load && frame < c.at).map((c) => {
    let lit = null;
    for (const [s, t] of c.load >= 40 ? ONE : TWO) if (frame >= c.at - c.load + Math.round(s * c.load)) lit = t;
    if (!lit) return null;
    const path = lit.map((t) => "M" + ((t % COLS) * tw).toFixed(1) + " " + (Math.floor(t / COLS) * th).toFixed(1) + "h" + tw.toFixed(1) + "v" + th.toFixed(1) + "h-" + tw.toFixed(1) + "Z").join(" ");
    return h("div", { key: "load" + c.i, style: { ...box, clipPath: "path('" + path + "')" } }, h(Footage, { shot: c.i, style: box }));
  });

  // Before its last cut, what her last shot shows (a dish seen from above, a product in her hand: named by its filler),
  // cut out and laid at once on the shot before, exactly where it will be, five images before the cut, which then brings
  // the rest of its picture around it. Nothing named or found there: a plain cut on its whoosh.
  const named = "@objet".charAt(0) !== "@";
  const lastCut = cuts.length ? cuts[cuts.length - 1] : null;
  const LEAD = Math.max(3, Math.round(5 * IMG));
  const laidEarly = named && lastCut && frame >= lastCut.at - LEAD && frame < lastCut.at ? h(Subject, { key: "o", shot: lastCut.i, object: "@objet", style: box }) : null;

  // A camera flash in the card only, on the cut of its shutter: two white images on the first of a run, then an image
  // 80 % white on each one after it.
  let white = 0;
  groups.filter((g) => g.kind === 2).forEach((g) => g.events.forEach((e, k) => {
    const c = e.cut;
    if (!k && frame >= c.at && frame < c.at + 2) white = 1;
    if (k && frame === c.at) white = 0.8;
  }));
  const flash = white ? h("div", { key: "flash", style: { ...box, background: WHITE, opacity: white } }) : null;
  const card = h("div", { key: "card", style: { position: "absolute", left: CX, top: CY, width: CW, height: CH, borderRadius: 30, overflow: "hidden", backgroundColor: "#000000" } }, film, tiles, laidEarly, flash);

  // 2. Its title, there from the first image to the last: a big word in a bold grotesque set tight, as wide as the card
  // and sitting on it (a short one 1,45 times as tall as the original's at most), and her small words on its two ends,
  // the first on the left, the rest on the right, falling into place on the opening whoosh (an image high, then there).
  const halves = (text) => {
    const w = String(text || "").split(/[ \t\n]+/).filter(Boolean);
    if (w.length < 2) return [w.join(" "), ""];
    const gap = (k) => Math.abs(w.slice(0, k).join(" ").length - w.slice(k).join(" ").length);
    let best = 1;
    for (let k = 2; k < w.length; k++) if (gap(k) < gap(best)) best = k;
    return [w.slice(0, best).join(" "), w.slice(best).join(" ")];
  };
  const big = caps(word("titre"));
  const pair = halves(caps(word("surtitre")));
  const BIG = Math.min(196, Math.round(CW / (Math.max(4, Array.from(big).length) * 0.5)));
  const heading = big
    ? h(FitText, { key: "title", style: { position: "absolute", left: CX, top: CY - 248, width: CW, height: 244 }, innerStyle: { justifyContent: "flex-end" } }, (scale) =>
        h("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "stretch" } },
          pair[0]
            ? h("div", { style: { display: "flex", justifyContent: pair[1] ? "space-between" : "flex-start", gap: Math.round(28 / scale), fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: Math.round(62 / Math.max(0.6, scale)), lineHeight: 1, letterSpacing: "-0.02em", color: WHITE, whiteSpace: "nowrap", marginBottom: -Math.round(8 / scale), opacity: frame >= FALL ? 1 : 0, transform: frame === FALL ? "translateY(" + Math.round(-60 / scale) + "px)" : "none" } },
                h("span", null, pair[0]),
                pair[1] ? h("span", null, pair[1]) : null)
            : null,
          h("div", { style: { fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: BIG, lineHeight: 0.8, letterSpacing: "-0.025em", color: WHITE, whiteSpace: "nowrap", textAlign: "center" } }, big)))
    : null;

  // 3. Under the card, the name of the sound heard, white capitals that change at once with it.
  const g = shownLabel >= 0 ? groups[shownLabel] : null;
  const heard = g ? NAMES[g.kind] + (g.count > 1 ? " x" + g.count : "") : "";
  const label = heard ? h(FitText, { key: "n" + shownLabel, style: { position: "absolute", left: 140, top: LABEL_Y - 50, width: 800, height: 100 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSynthesis: "none", fontSize: 70, lineHeight: 1, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap" } }, heard) : null;

  // 4. Under it, this moment's timeline as an editing app shows it (a graphic: decor): its timecode running, its red
  // playhead crossing it at a constant speed from its first image to its last; her shots on its first video track, its
  // loadings, flashes and cut-out on the two above, its sounds the green clips of its audio tracks, each where it is
  // heard, so the playhead passes over a clip as the label names it.
  const X0 = 117;
  const X1 = 807;
  const xAt = (f) => X0 + Math.max(0, Math.min(1, f / Math.max(1, durationInFrames - 1))) * (X1 - X0);
  const clip = (key, f0, f1, y, hh, bg, child) => h("div", { key, style: { position: "absolute", left: Math.round(xAt(f0)), top: y, width: Math.max(3, Math.round(xAt(f1) - xAt(f0)) - 1), height: hh, borderRadius: 2, overflow: "hidden", background: bg } }, child || null);
  const pad = (v) => (v < 10 ? "0" : "") + v;
  const tracks = [["V9", 36, 8], ["V8", 47, 8], ["V7", 58, 8], ["V6", 69, 8], ["V5", 80, 8], ["V4", 91, 8], ["V3", 102, 8], ["V2", 113, 9], ["V1", 125, 28], ["A1", 160, 24], ["A2", 192, 24], ["A3", 224, 24]];
  const chip = { width: 9, height: 6, borderRadius: 1, background: "#3d3a46" };
  const heads = tracks.map((r) => h("div", { key: "h" + r[0], style: { position: "absolute", left: 18, top: r[1] + Math.round((r[2] - 9) / 2), height: 9, display: "flex", alignItems: "center", gap: 5 } },
    h("div", { style: { width: 15, height: 9, borderRadius: 2, background: "#8c2b35", color: "#f6dada", fontFamily: body, fontSize: 6, lineHeight: "9px", textAlign: "center" } }, r[0]),
    h("div", { style: chip }), h("div", { style: chip }), h("div", { style: chip })));
  const last = durationInFrames - 1;
  const blue = "repeating-linear-gradient(90deg, #2f67a8 0 9px, #23538c 9px 10px)";
  const strip = "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 2px, transparent 2px 14px), linear-gradient(180deg, #67636f, #44414c)";
  const bars = [
    clip("b9", 0, last, 36, 8, "#d8c7a8"), clip("b8", 0, last, 47, 8, "#cdbb98"), clip("b7", 0, last, 58, 8, "#3e6eb0"),
    clip("b6", last * 0.03, last, 69, 8, "#e8590c"), clip("b5", 0, last, 80, 8, "#e4550a"),
    ...cuts.filter((c) => c.kind === 3).map((c) => clip("c" + c.i, c.at - c.load, c.at, 113, 9, blue)),
    ...cuts.filter((c) => c.kind === 2).map((c) => clip("f" + c.i, c.at, c.at + 2, 102, 8, blue)),
    named && lastCut ? clip("o" + lastCut.i, lastCut.at - LEAD, lastCut.at, 102, 8, blue) : null,
    ...mine.map((i, k) => h(React.Fragment, { key: "v" + i },
      clip("v" + i, Math.max(0, shots[i].from), Math.min(last, shots[i].from + shots[i].durationInFrames), 125, 19, strip),
      clip("vl" + i, Math.max(0, shots[i].from), Math.min(last, shots[i].from + shots[i].durationInFrames), 145, 8, k % 2 ? "#3b80d6" : "#b46fca"))),
  ];
  const diamond = h("div", { style: { position: "absolute", left: "50%", top: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, transform: "rotate(45deg)", background: "rgba(255,255,255,0.85)" } });
  const wave = h("div", { style: { position: "absolute", left: 2, right: 2, top: 9, height: 6, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px)" } });
  const sound = (key, f0, f1, row) => clip(key, f0, f1, [160, 192, 224][row], 24, "#2E8162", row === 2 ? wave : diamond);
  const sounds = events.map((e, k) => (e.kind === 1 ? sound("w" + k, e.at - 8, e.at + 5, 1) : e.kind === 3 ? sound("d" + k, e.start, e.end, 2) : sound("t" + k, e.start, e.end, 0)));
  const head = xAt(frame);
  const ruler = Array.from({ length: 6 }, (_, i) => h("div", { key: "r" + i, style: { position: "absolute", left: Math.round(X0 + (i * (X1 - X0)) / 5) + 3, top: 10, fontFamily: body, fontSize: 7, color: "#8b8896" } }, "01:00:" + pad(Math.floor((i * durationInFrames) / 150)) + ":00"));
  const timeline = h("div", { key: "timeline", "data-fauve-decor": "", style: { position: "absolute", left: 135, top: TL_Y, width: 809, height: 266, borderRadius: 22, overflow: "hidden", background: "#232128" } },
    h("div", { style: { position: "absolute", left: 26, top: 9, fontFamily: body, fontWeight: 700, fontSize: 14, color: "#e4e2e9", letterSpacing: "0.02em" } }, "01:00:" + pad(Math.floor(frame / 30)) + ":" + pad(frame % 30)),
    h("div", { style: { position: "absolute", left: 112, top: 0, width: 1, height: 266, background: "#34313d" } }),
    h("div", { style: { position: "absolute", left: X0, top: 30, width: X1 - X0, height: 1, background: "#3b3846" } }),
    ruler, heads, bars, sounds,
    h("div", { style: { position: "absolute", left: Math.round(head - 1), top: 14, width: 2, height: 252, background: "#ff3131" } }),
    h("div", { style: { position: "absolute", left: Math.round(head - 6), top: 3, width: 12, height: 12, background: "#ff3131", clipPath: "polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)" } }));

  // The ground: an electric blue, squared with fine violet lines like a technical sheet, still; no gradient, grain nor shadow.
  const ground = { backgroundColor: "#15017A", backgroundImage: "linear-gradient(#432DA9 0 2px, transparent 2px), linear-gradient(90deg, #432DA9 0 2px, transparent 2px)", backgroundSize: "33.75px 33.75px", backgroundPosition: "13px 33px" };
  return h(AbsoluteFill, { style: ground }, heading, card, label, timeline);
}`;

export const coulisses: EffectPiece = {
  key: "coulisses",
  version: 1,
  name: "Coulisses façon fiche",
  how: "ses plans passent dans une fiche technique sur un fond bleu électrique quadrillé, immobile : en haut un grand titre en capitales grasses, au milieu une carte aux coins arrondis où passent ses plans, dessous le nom de chaque bruitage au moment où on l'entend (« WHOOSH x2 », « CHARGEMENT », « DÉCLENCHEUR », « DÉCLICS »), en bas la timeline du montage et sa tête de lecture rouge ; sur ses coupes, le plan suivant qui se charge case par case, un flash photo, une coupe qui hésite, et ce que montre le dernier plan qui arrive détouré juste avant lui ; puis le montage reprend en plein écran.",
  needs: "des vidéos de son lieu et de ses gestes, à l'horizontale de préférence (la carte est en 16:9, carrée pour des vidéos verticales) ; pour finir, un plan où l'on voit net un plat, une tasse ou un produit tenu en main.",
  lays: "sur 3 à 10 de ses plans coupés d'un ou deux temps, le premier assez long (deux temps) pour que le suivant s'y charge case par case",
  shots: [2, 10],
  seconds: [2.4, 8],
  require: { files: 3, shot: { video: true } },
  texts: [
    {
      slot: "titre",
      want: "le grand titre en capitales grasses posé sur la carte, aussi large qu'elle : un seul mot, « coulisses » ou son lieu (une forme comme « coulisses », « fournil », « atelier », « comptoir »)",
      max: 14,
      required: true,
    },
    {
      slot: "surtitre",
      want: "2 ou 3 petits mots posés au-dessus des deux bouts du grand titre (le premier à gauche, le reste à droite), lus avant lui : avec lui, une seule phrase (une forme comme « bruitages en » + « coulisses », « le son du » + « fournil », « les coulisses du » + « comptoir »)",
      max: 20,
      required: false,
    },
  ],
  objects: [
    {
      slot: "objet",
      shot: -1,
      want: "ce qu'on voit net au milieu de son dernier plan, vu d'en haut ou de près, qui arrive détouré sur le plan d'avant juste avant la coupe : un plat, une tasse, un bouquet, un produit tenu en main (« plate of pastries », « coffee cup », « bouquet of roses », « hand holding a box ») ; « none » quand rien n'y est net",
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format de la carte : 16:9 comme l'original, ou carrée",
      choices: [
        { value: "auto", says: "comme ses vidéos (16:9 si la plupart sont horizontales, carrée sinon)" },
        { value: "horizontal", says: "une carte 16:9, comme l'original (une vidéo verticale y est cadrée sur son sujet)" },
        { value: "vertical", says: "une carte carrée de la même largeur, pour des vidéos verticales" },
      ],
    },
  ],
  timeline({ bpm, shots }) {
    // Its beat as its code reads it (texts.beat, to the thousandth), so each sound lands on the frame its move does.
    const beat = Math.round(((60 / bpm) * 30) * 1000) / 1000;
    const plan = cutPlan(shots, beat);
    return {
      marks: {
        fall: fallFrame(beat),
        ...Object.fromEntries(plan.map((c, k) => [`k${k + 1}`, c.kind])),
        ...Object.fromEntries(plan.flatMap((c, k) => (c.kind === CUT.load ? [[`ld${k + 1}`, c.load]] : []))),
      },
      sounds: cutSounds(plan, beat),
    };
  },
  code: CODE,
};
