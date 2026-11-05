import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Ta ville racontée », the effect (docs/fiches/vlog-ville.md, effects 1 to 4; its whole Reel is skills/vlog-ville.ts):
// its opening, the moment that makes it, laid on two to four of her shots at the start of any Reel. On her first shot,
// wide and calm, her sentence comes one word at a time in small white lowercase subtitles, no music under it, then her
// second, which ends on her place's name; the music drops on the cut (it comes back on that beat): her next shot bursts
// into nine close-ups, two and three images each (the original's 2, 3, 2, 3…), each framed on another part of it, then
// the same shot swept (a whip); on her last shot (someone from behind, still, the world moving), half a second in, her
// name in big red capitals between quotes, her signature small above it, its small line under it, the music muffled
// under it. Then the montage takes over. Kept from the skill: its words' row and size (48 px, white, a tight shade), its
// words' rhythm (each word as long as it is, the last held, the second sentence's last word over the burst), its burst
// (the same nine framings, its pieces' lengths), its sweep, its title (its sizes on the frame's width, its colour: hers
// when vivid, else a film title's red), its music held back then dropping on her name, muffled under the title. Left:
// its 4:3 frame (the effect plays in the Reel's frame), its 31 roles, its recalls, its other bursts, its loop.

/** Its burst's pieces (images each, the original's) and the part of her shot each one is framed on (% of its width and height). */
export const VLOG_RUN = [2, 3, 2, 3, 2, 3, 2, 3, 2];
const BURST = VLOG_RUN.reduce((a, b) => a + b, 0);
/** Its sweep after the burst (images). */
const SWEEP = 14;

/** Its moments, frames from its start: its words, its drop (the cut on her second shot), its title (−1: none). */
export function vlogMoments(input: Pick<PieceTimelineInput, "frames" | "shots">): { from: number; ici: number; drop: number; title: number } {
  const frames = Math.max(1, Math.round(input.frames));
  const sorted = [...input.shots].sort((a, b) => a.from - b.from).filter((s) => s.from + s.frames > 0 && s.from < frames);
  const second = sorted[1];
  // The drop on the cut into her second shot (the original's 2,63 s), else a third of the way in.
  const drop = Math.max(Math.min(12, frames - 1), Math.min(frames - 1, Math.round(second ? second.from : frames * 0.35)));
  // Her sentence from 23 % of her first shot, her second from 67 % (the original's images 18 and 53 of 79).
  const from = Math.round(drop * 0.23);
  const ici = Math.max(from + 1, Math.round(drop * 0.67));
  // Her title half a second into her last shot (from her third), after the burst and its sweep; else after them on her
  // second; none without a second and a half of it before the effect ends.
  const last = sorted.length >= 3 ? sorted[sorted.length - 1]! : null;
  const at = Math.max(drop + BURST + SWEEP, last ? Math.round(last.from) + 15 : drop + BURST + SWEEP + 15);
  return { from, ici, drop, title: at <= frames - 45 ? at : -1 };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const list = shots || [];
  // Its shots: those that play during it, in order (its second one bursts on the drop; its last one gets the title).
  const mine = list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const box = { position: "absolute", left: 0, top: 0, width, height };
  const DROP = Math.round(mark("drop", Math.round(D * 0.35)));
  const FROM = Math.round(mark("words_from", Math.round(DROP * 0.23)));
  const ICI = Math.round(mark("words_second", Math.round(DROP * 0.67)));
  const TITLE = Math.round(mark("title", -1));
  const RUN = ${JSON.stringify(VLOG_RUN)};
  const SPOTS = [[22, 30], [74, 62], [40, 78], [80, 22], [30, 60], [62, 36], [16, 80], [86, 78], [50, 50]];

  // 1. On the drop, her second shot in nine close-ups, each framed on another part of it, then swept along (a whip);
  // only while it plays (a short one ends its burst at its cut).
  const det = mine.length > 1 ? mine[1] : -1;
  const detEnd = det >= 0 ? list[det].from + list[det].durationInFrames : -1;
  let picture = null;
  if (det >= 0 && frame >= DROP && frame < detEnd) {
    const off = frame - DROP;
    if (off < ${BURST}) {
      let k = 0;
      let at = RUN[0];
      while (k < 8 && off >= at) at += RUN[++k];
      picture = h("div", { key: "close", style: { ...box, overflow: "hidden" } },
        h(Footage, { shot: det, style: { ...box, transform: "scale(1.75)", transformOrigin: SPOTS[k][0] + "% " + SPOTS[k][1] + "%" } }));
    } else if (off < ${BURST + SWEEP}) {
      const p = (off - ${BURST} + 0.5) / ${SWEEP};
      const id = "vlog-sweep-" + frame;
      picture = h("div", { key: "sweep", style: { ...box, overflow: "hidden" } },
        h("svg", { width: 0, height: 0, style: { position: "absolute" } },
          h("filter", { id, x: "-20%", y: "-20%", width: "140%", height: "140%", colorInterpolationFilters: "sRGB" }, h("feGaussianBlur", { stdDeviation: "34 0" }))),
        h("div", { style: { ...box, transform: "translateX(" + Math.round((p - 0.5) * 0.16 * width) + "px) scale(1.25)", filter: "url(#" + id + ")" } }, h(Footage, { shot: det, style: box })));
    }
  }

  // 2. Her two sentences as small white subtitles, one word at a time, each word as long as it is, the last held; the
  // second one's last word (her place's name) held over the burst.
  const body = "'" + brand.bodyFont + "', 'Inter Tight', sans-serif";
  const display = "'" + brand.displayFont + "', 'Inter Tight', sans-serif";
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const oneByOne = (text, a, b, hold) => {
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length || frame < a || frame >= b) return null;
    const weights = words.map((w, k) => (w.length + 2) * (k === words.length - 1 ? hold : 1));
    const total = weights.reduce((x, y) => x + y, 0);
    let at = a;
    for (let k = 0; k < words.length; k++) {
      at += ((b - a) * weights[k]) / total;
      if (frame < at) return words[k];
    }
    return words[words.length - 1];
  };
  const shown = oneByOne(word("phrase"), FROM, ICI, 2.5) || oneByOne(word("ici"), ICI, Math.min(D, det >= 0 ? Math.min(detEnd, DROP + ${BURST}) : DROP + ${BURST}), 3);
  const ROW = Math.round(height * 0.72);
  const subtitle = shown
    ? h("div", { key: "sub", style: { position: "absolute", left: 140, top: ROW - 130, width: 800, height: 130, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" } },
        h("div", { style: { fontFamily: body, fontWeight: 400, fontSize: 48, lineHeight: 1.18, color: "#ffffff", textAlign: "center", textShadow: "0 1px 2px rgba(0,0,0,0.55)" } }, keep(shown)))
    : null;

  // 3. Her title on her last shot, at once, to the end: her name in big capitals between quotes, her signature small
  // above, its small line under, in one red (hers when vivid enough, else a film title's), in the middle.
  const rgb = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim()); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const vivid = (c) => { const p = rgb(c); if (!p) return false; const hi = Math.max(p[0], p[1], p[2]); const lo = Math.min(p[0], p[1], p[2]); const l = (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255; return hi > 0 && (hi - lo) / hi > 0.45 && l > 0.1 && l < 0.6; };
  const RED = vivid(brand.accent) ? brand.accent : "#d7261e";
  const name = word("nom");
  const sign = word("signature");
  const line = word("genre");
  const CY = Math.round(height * 0.46);
  const NH = Math.round(width * 0.1125);
  const title = TITLE >= 0 && frame >= TITLE && name
    ? h("div", { key: "title" },
        h(FitText, { key: "n-" + name, style: { position: "absolute", left: 140, top: CY - Math.round(NH / 2), width: 800, height: NH }, innerStyle: { fontFamily: display, fontWeight: 900, fontSize: 108, lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", whiteSpace: "nowrap", color: RED } }, "”" + name + "”"),
        sign ? h(FitText, { key: "s-" + sign, style: { position: "absolute", left: 140, top: CY - Math.round(NH / 2) - 66, width: 800, height: 52 }, innerStyle: { fontFamily: display, fontWeight: 900, fontSize: 42, lineHeight: 1, textTransform: "uppercase", whiteSpace: "nowrap", color: RED } }, h("span", { "data-fauve-accent": "" }, keep(sign))) : null,
        line ? h(FitText, { key: "g-" + line, style: { position: "absolute", left: 140, top: CY + Math.round(NH / 2) + 16, width: 800, height: 40 }, innerStyle: { fontFamily: body, fontWeight: 700, fontSize: 28, lineHeight: 1, whiteSpace: "nowrap", color: RED } }, h("span", { "data-fauve-accent": "" }, keep(line))) : null)
    : null;

  return h(AbsoluteFill, null, picture, title, subtitle);
}`;

export const vlogVille: EffectPiece = {
  key: "vlog-ville",
  version: 1,
  name: "Ouverture de court-métrage",
  how: "sur son premier plan, large et calme, sa phrase arrive mot à mot en petits sous-titres sans musique, puis la deuxième qui finit sur son nom ; la musique tombe sur la coupe et son plan suivant éclate en neuf gros plans de deux et trois images, puis file ; sur son dernier plan, quelqu'un de dos, son nom en grandes capitales rouges entre guillemets, sa signature au-dessus et une petite ligne dessous, la musique étouffée ; puis le montage reprend.",
  needs: "un plan large et calme de son lieu ou de sa rue (quelqu'un d'immobile au milieu de préférence), un plan d'un détail plein de choses filmé de près (sa carte, une étagère, une vitrine), et quelqu'un de dos immobile devant ce qui passe.",
  lays: "au début du Reel ou d'une partie, sans voix dessous, sur deux à quatre plans : le premier calme de 2 à 3 s (ses mots y arrivent), le deuxième le détail (la rafale tombe sur sa coupe), le dernier quelqu'un de dos (le titre, 2 s au moins), 5 à 9 s en tout",
  shots: [2, 4],
  seconds: [3, 9],
  require: { files: 2, shot: { framing: ["wide", "medium"] } },
  texts: [
    { slot: "phrase", want: "sa première phrase, qui arrive mot à mot sur son premier plan, en minuscules comme un sous-titre : le rythme ou l'âme de son quartier ou de son lieu (une forme comme « Chaque quartier a son rythme ») ; 5 mots au plus", max: 32, required: true },
    { slot: "ici", want: "la deuxième phrase, mot à mot, qui finit sur le nom de son quartier ou de son lieu (une forme comme « voici Belleville. ») : la musique tombe sur son dernier mot ; 4 mots au plus", max: 30, required: true },
    { slot: "nom", want: "le titre du court-métrage, en grandes capitales rouges entre guillemets : le nom que dit la deuxième phrase (son quartier, sa ville ou son lieu) ; 1 ou 2 mots", max: 14, required: true },
    { slot: "signature", want: "facultatif : sa signature en petit au-dessus du titre, comme celle d'un réalisateur : son nom ou son compte (une forme comme « par Maison Farine »), jamais inventée", max: 20, required: false },
    { slot: "genre", want: "facultatif : la petite ligne sous le titre, en minuscules avec un point (« un court-métrage. », ou une forme comme « un film de quartier. »)", max: 22, required: false },
  ],
  timeline(input: PieceTimelineInput): PieceTimeline {
    const m = vlogMoments(input);
    return {
      marks: { words_from: m.from, words_second: m.ici, drop: m.drop, ...(m.title >= 0 ? { title: m.title } : {}) },
      // No music under her words: it comes back on the drop, on a beat of the Reel; muffled under her title.
      music: {
        ...(m.drop >= 6 ? { pauses: [{ from: 0, to: round3(m.drop / 30) }] } : {}),
        ...(m.title >= 0 ? { filters: [{ kind: "muffled" as const, from: round3(Math.max(0, m.title - 5) / 30), to: round3(Math.min(input.frames, m.title + 39) / 30) }] } : {}),
      },
    };
  },
  code: CODE,
};
