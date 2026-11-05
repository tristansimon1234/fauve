import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Le plat, puis la dégustation », the effect (docs/fiches/chef-face.md, effects 1, 2, 4 and 5; its whole Reel is
// skills/chef-face.ts, version 1): over a run of her shots the editor cut (her dish being finished, then her, face to
// camera, last), what she says written as its original writes it, then her formula on her face. Timed on what she says
// under it (`spoken`): her words two to four at a time (22 signs at most), cut in at once as she says them, on one line
// at 59,3 % of the height, cream (#F2E9DC) capitals of her title font with a soft dark shadow, no box; its strong words
// (`fort`, as she says them) 1,75 times as big in the same place, from the instant she says them (said nowhere under it:
// over her shots before her face, from the first image); on its last shot (her face), her formula (`fin`: « Bon
// appétit ! ») 3,3 times as big on two lines to its last image, nothing else written, the music stopped dead under it
// (its original's silence before its formula) and back with the montage. Her words off her face on her shot (read once:
// under her chin, else above her head). Nothing of her cut out, no shot drawn: the montage plays under it. Left out: the
// model's images laid in turn on her ideas, its steps on her words (the montage's own cuts), its format setting.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, spoken, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const list = shots || [];
  const mine = list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const display = "'" + brand.displayFont + "', 'Inter Tight', 'Arial Narrow', sans-serif";
  // Its last shot (her face): her formula on it to the end; before it, her dish.
  const k1 = mine.length ? mine[mine.length - 1] : -1;
  const LAST = Math.round(Math.max(0, Math.min(D - 1, mark("last", k1 >= 0 ? Math.max(0, list[k1].from) : Math.round(D * 0.6)))));
  const FIN = word("fin");
  const FORT = word("fort");

  // 1. What she says under it, each word at its frame, and its letters alone (accents and case aside).
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const said = (Array.isArray(spoken) ? spoken : [])
    .filter((w) => w && typeof w.w === "string" && Number.isFinite(w.from))
    .map((w) => ({ w: String(w.w), from: Math.round(w.from), to: Math.round(Number.isFinite(w.to) ? w.to : w.from + 8), bare: plain(w.w) }))
    .sort((a, b) => a.from - b.from);
  // Its strong words found in hers before her formula (its first word on the image she says it, its last word's end
  // and a breath, never into her next word); said nowhere: over her shots before her face, from the first image.
  const tokens = plain(FORT).split(" ").filter(Boolean);
  const before = said.filter((w) => w.from < LAST);
  let strong = null;
  for (let j = 0; FORT && tokens.length && j + tokens.length <= before.length && !strong; j++) {
    let ok = true;
    for (let q = 0; q < tokens.length && ok; q++) { const a = before[j + q].bare; const b = tokens[q]; ok = a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))); }
    if (ok) {
      const last = before[j + tokens.length - 1];
      const next = before[j + tokens.length];
      strong = { from: before[j].from, to: Math.min(LAST, Math.max(last.to, Math.min(last.to + 8, next ? next.from : Infinity))) };
    }
  }
  if (!strong && FORT && !before.length && LAST > 12) strong = { from: 0, to: LAST };

  // 2. Her words two to four at a time (22 signs at most), as its original: a new chunk after a comma, a full stop or a
  // pause, and before its strong words; each from her first word of it, replaced by the next one (0,4 s after its last
  // word when she pauses), never into its strong words nor her formula.
  const free = before.filter((w) => !strong || w.from < strong.from || w.from >= strong.to);
  const signs = (c) => c.reduce((n, w) => n + w.w.length, 0) + Math.max(0, c.length - 1);
  const chunks = [];
  let c = [];
  free.forEach((w, i) => {
    const prev = free[i - 1];
    const cut = prev && c.length && (w.from - prev.to >= 8 || /[.!?…,;:]$/.test(prev.w) || c.length >= 4 || signs(c.concat([w])) > 22 || (strong && strong.from > prev.from && strong.from <= w.from));
    if (cut) { chunks.push(c); c = []; }
    c.push(w);
  });
  if (c.length) chunks.push(c);
  const shown = chunks.map((x, k) => {
    const from = x[0].from;
    const ends = [LAST, chunks[k + 1] ? chunks[k + 1][0].from : Infinity, x[x.length - 1].to + 12].concat(strong && strong.from > from ? [strong.from] : []);
    return { words: x, from, to: Math.min.apply(null, ends) };
  });
  const up = (s) => String(s || "").toUpperCase().replace(/(\d)(\s?)H(?![A-ZÀ-ÖØ-Ý])/g, "$1$2h");
  const chunkText = (x) => x.map((w) => w.w).join(" ").replace(/[,;:]+$/, "").replace(/([^.])\.$/, "$1");

  // 3. The line her words are set on (its original's, 59,3 % of the height); on her last shot off her face (read once),
  // as tall as each text is: under her chin when it fits there, else above her head.
  const LINE = Math.round(H * 0.593);
  const herFace = React.useMemo(() => {
    if (typeof track !== "function" || k1 < 0) return null;
    const seen = track(Math.round(Math.min(D - 1, (LAST + D) / 2))) || {};
    const found = (seen.faces || []).filter((x) => x && x.width > 0 && x.height > 0);
    if (!found.length) return null;
    const face = found.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    return { top: face.y - face.height * 0.95, bottom: face.y + face.height * 0.75 };
  }, [track, LAST, D]);
  const face = frame >= LAST ? herFace : null;
  const place = (half) => {
    if (!face || face.bottom < LINE - half - H * 0.01 || face.top > LINE + half + H * 0.01) return LINE;
    const under = face.bottom + half + H * 0.02;
    if (under + half <= H * 0.75) return Math.round(under);
    const over = face.top - half - H * 0.02;
    return over - half >= H * 0.06 ? Math.round(over) : LINE;
  };

  // 4. Small, strong 1,75 times as big, her formula 3,3 times on two lines; each box centred, left of the apps' buttons,
  // above the bottom quarter.
  const S = Math.max(48, Math.round(H * 0.0285));
  const B = Math.round(S * 1.75);
  const F = Math.round(S * 3.3);
  const type = (size) => ({ fontFamily: display, fontWeight: 700, fontSynthesis: "none", fontSize: size, lineHeight: 1, letterSpacing: "0.01em", color: "#f2e9dc", textShadow: "0 0 7px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.5)", textAlign: "center", whiteSpace: "nowrap" });
  const at = (tall) => { const y = place(tall / 2); return { position: "absolute", left: 140, width: W - 280, top: Math.round(Math.max(H * 0.06, Math.min(H * 0.75 - tall, y - tall / 2))), height: Math.round(tall) }; };
  const chunkNow = frame < LAST && !(strong && frame >= strong.from && frame < strong.to) ? shown.find((s) => frame >= s.from && frame < s.to) || null : null;
  const out = FIN && frame >= LAST
    ? h(FitText, { key: "f-" + up(FIN), style: at(F * 2.15), innerStyle: { ...type(F), lineHeight: 0.95, whiteSpace: "normal", textWrap: "balance" } }, up(FIN))
    : strong && frame >= strong.from && frame < strong.to
      ? h(FitText, { key: "k-" + up(FORT), style: at(B * 1.3), innerStyle: type(B) }, up(FORT))
      : chunkNow
        ? h(FitText, { key: "s-" + chunkNow.from, style: at(S * 1.45), innerStyle: type(S) }, up(chunkText(chunkNow.words)))
        : null;
  return h(AbsoluteFill, null, out);
}`;

/** Its last shot's start (frames from its start): her formula from it to the end, the music stopped under it. */
export function chefFaceLast(input: Pick<PieceTimelineInput, "frames" | "shots">): number {
  const last = input.shots.at(-1);
  const from = last ? Math.max(0, last.from) : Math.round(input.frames * 0.6);
  return Math.round(Math.max(0, Math.min(input.frames - 1, from)));
}

export const chefFace: EffectPiece = {
  key: "chef-face",
  version: 1,
  name: "Le plat, puis la dégustation",
  how: "sur ses gros plans du plat puis son plan à elle qui goûte ou qui parle : ce qu'elle dit écrit deux à quatre mots à la fois au milieu de l'écran, en capitales serrées crème posées d'un coup, ses mots forts 1,75 fois plus grands ; sur son dernier plan, sa formule de fin en très grand sur deux lignes, la musique coupée net dessous ; puis le montage reprend.",
  needs: "des gros plans de son plat ou de ce qu'elle fait (verser, dresser, la bouchée), puis un plan d'elle ou de quelqu'un de l'équipe face caméra, qui goûte ou qui parle.",
  lays: "sur deux à huit plans, ses gros plans du plat d'abord et son plan face caméra en dernier (une seconde au moins), à la fin du Reel de préférence, pendant qu'elle parle",
  shots: [2, 8],
  seconds: [2.5, 12],
  require: { files: 2, shot: { person: true } },
  spoken: true,
  texts: [
    { slot: "fort", want: "facultatif : ses mots forts sur les gros plans, deux à quatre mots qu'elle dit d'un trait, tels qu'elle les dit (une forme comme « 48 heures de pousse », « tout est maison ») ; sans ses mots dits, une ligne courte sur son plat : écrits en grand au milieu", max: 28, required: false },
    { slot: "fin", want: "sa formule de fin, ses derniers mots ou une invitation (une forme comme « Bon appétit ! », « Venez la goûter ! », « À samedi ! ») : écrite en très grand sur deux lignes sur son dernier plan", max: 28, required: true },
  ],
  timeline(input) {
    const last = chefFaceLast(input);
    // Her music stopped dead from her last shot (her formula, its original's silence) to its end, back with the montage.
    const pause = input.frames - last >= 12 && last >= 6 ? { music: { pauses: [{ from: Math.round((last / 30) * 1000) / 1000, to: Math.round((input.frames / 30) * 1000) / 1000 }] } } : {};
    return { marks: { last }, ...pause };
  },
  code: CODE,
};
