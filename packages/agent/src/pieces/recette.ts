import type { EffectPiece } from "../pieces.ts";

// « Pas à pas raconté », the effect (docs/fiches/recette.md, effects 2 and 4; its whole Reel is skills/recette.ts,
// version 1): over a run of her gestures filmed phone posed (a step cut gesture by gesture in the same frame, or a few
// steps), her words written in the middle of the picture as a creator subtitles his voice: groups of one to three words
// (never ending on « de », « la », « tu »…, a number with its word, a verb with what it takes, two short neighbours
// together), one on each of her shots under it, cut in on its cut and gone with the next, held as long as its gesture
// (three words or more: 1,4 s at least, the time to read it); more groups than shots share them by what each needs, a
// change moved onto a cut when one is near. A bold serif in lower case (her display font; its pairing's Gelasio, a
// Georgia twin), a warm white, a faint dark shadow, no box, at 64 px, its middle at half the height; under the face of
// someone who looks at the lens (tracked), never on it. Every group stays in the page, hidden but the one seen, so the
// scene check finds the whole text. Kept of its skill: its grouping, its timing on the cuts, its type, its place, its
// hidden rest, its way round a face. Left: its result first and its tasting (the editor lays her shots), its 57
// gestures' timing, its format and its ending card, its grade. No sound, no music shaped: the original has none.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = Math.max(1, durationInFrames);
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v : ""; };
  const list = shots || [];
  // Its shots: those the engine counts under it, else those that play during it.
  const given = String((texts && texts.mine) || "").split(",").map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0 && x < list.length);
  const mine = given.length ? given : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const cuts = mine.map((i) => list[i].from).filter((f) => f > 2 && f < D - 2).sort((a, b) => a - b);
  const at = (f) => mine.reduce((k, i) => (list[i].from <= f ? i : k), mine.length ? mine[0] : -1);

  // 1. Her words as a creator subtitles what he says (its skill's grouping): a comma, a full stop or a « / » always a
  // change; no punctuation shown, every mark kept in the page, hidden.
  const LIGHT = new Set("le la les l un une des du de d au aux à a en et ou ni mais donc car que qu qui dont ce c cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je j tu t te il ils elle elles on nous vous se s y ne n me m lui sur sous dans par pour avec sans chez vers entre est es sont ai as ont va vas vont si deux trois quatre cinq six sept huit neuf dix douze quinze vingt trente cent mille".split(" "));
  const LEADS = new Set("le la les l un une des du de d au aux à en ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs deux trois quatre cinq six sept huit neuf dix douze quinze vingt trente cent mille".split(" "));
  const bare = (w) => w.toLowerCase().replace(/^.*['’]/, "").replace(/[^\p{L}\p{N}]/gu, "");
  const light = (w) => /^\d/.test(w) || /['’]$/.test(w) || LIGHT.has(bare(w));
  const leads = (w) => /^\d/.test(w) || /^(l|d|qu)['’]/i.test(w) || LEADS.has(bare(w));
  const phrase = (text) => {
    const words = [];
    let lead = "";
    String(text || "").split(/(\s+)/).forEach((p) => {
      if (!p) return;
      const last = words[words.length - 1];
      if (/^\s+$/.test(p)) { if (last) last.after += p; else lead += p; return; }
      const m = /^(.*?)([,;:.…\/]*)$/u.exec(p);
      if (!/[\p{L}\p{N}]/u.test(m[1])) { if (last) { last.after += p; last.brk = true; } else lead += p; return; }
      words.push({ w: m[1], after: m[2], brk: Boolean(m[2]) });
    });
    const units = [];
    let u = [];
    words.forEach((x) => { u.push(x); if (!light(x.w) || x.brk) { units.push(u); u = []; } });
    if (u.length) { const prev = units[units.length - 1]; if (prev && !prev[prev.length - 1].brk) prev.push(...u); else units.push(u); }
    const size = (g) => g.reduce((s, x) => s + x.w.length, 0) + g.length - 1;
    const full = (g) => g.filter((x) => !light(x.w)).length;
    const joins = (g, b) => !g[g.length - 1].brk && g.length + b.length <= 3 && size(g) + 1 + size(b) <= 18;
    const groups = units.slice();
    for (let i = 0; i + 1 < groups.length; i++) if (leads(groups[i + 1][0].w) && joins(groups[i], groups[i + 1])) groups.splice(i, 2, groups[i].concat(groups[i + 1]));
    for (let i = 0; i + 1 < groups.length; i++) if (joins(groups[i], groups[i + 1]) && full(groups[i].concat(groups[i + 1])) <= 2) groups.splice(i, 2, groups[i].concat(groups[i + 1]));
    return { lead, items: groups.map((g) => ({ show: g.map((x) => x.w).join(" "), after: g[g.length - 1].after, tokens: g.length, chars: size(g) })) };
  };

  // 2. Each group's time: one on each run of her shots when they fit, cut in on its cut; else shared by what each one
  // needs to be read (three words or more: 0,8 s plus 0,3 s a word), the longer ones longer, a change moved onto a cut.
  const needOf = (g) => (g.tokens >= 3 ? Math.ceil(24 * (0.8 + 0.3 * g.tokens)) + 2 : 15);
  const timed = (items) => {
    const m = items.length;
    if (!m) return [];
    const G = cuts.length + 1;
    const edges = [0].concat(cuts, [D]);
    const need = items.map(needOf);
    if (m <= G) {
      const at0 = items.map((_, j) => edges[Math.floor((j * G) / m)]).concat([D]);
      if (items.every((_, j) => at0[j + 1] - at0[j] >= need[j])) return items.map((_, j) => ({ from: at0[j], to: at0[j + 1] }));
    }
    const N = need.reduce((s, x) => s + x, 0);
    const W = items.reduce((s, g) => s + g.chars + 4, 0);
    const d = items.map((g, j) => (N >= D ? (need[j] * D) / N : need[j] + ((D - N) * (g.chars + 4)) / W));
    const t = [0];
    for (let j = 0; j < m; j++) t.push(t[j] + d[j]);
    t[m] = D;
    for (let j = 1; j < m; j++) {
      const near = cuts.filter((c) => Math.abs(c - t[j]) <= 8 && c - t[j - 1] >= Math.min(need[j - 1], d[j - 1]) && t[j + 1] - c >= Math.min(need[j], d[j]));
      if (near.length) t[j] = near.reduce((x, y) => (Math.abs(y - t[j]) < Math.abs(x - t[j]) ? y : x));
    }
    return items.map((_, j) => ({ from: Math.round(t[j]), to: Math.round(t[j + 1]) }));
  };
  const told = React.useMemo(() => { const p = phrase(word("recit")); return { lead: p.lead, items: p.items, times: timed(p.items) }; }, [texts, D, shots]);

  // 3. Where its words sit on each of her shots: in the middle, as the original; under the face of someone who looks
  // at the lens (read in the box her shot is drawn in), never on it; above it when it is too low.
  const MID = Math.round(height / 2);
  const spot = React.useMemo(() => {
    const out = {};
    mine.forEach((i) => {
      const s = list[i];
      out[i] = MID;
      if (typeof track !== "function") return;
      const faces = [];
      for (let f = Math.max(0, s.from) + 1; f < Math.min(D, s.from + s.durationInFrames); f += 5) {
        const seen = track(f, { shot: i, left: 0, top: 0, width, height }) || {};
        (seen.faces || []).forEach((q) => { if (q && Number.isFinite(q.y) && Number.isFinite(q.height)) faces.push(q); });
      }
      if (!faces.length) return;
      const top = Math.min.apply(null, faces.map((q) => q.y - q.height / 2));
      const bottom = Math.max.apply(null, faces.map((q) => q.y + q.height * 0.62));
      if (MID + 62 < top || MID - 62 > bottom) return;
      const low = Math.round(bottom + 74);
      const high = Math.round(top - 74);
      out[i] = low + 62 <= height * 0.75 - 8 ? low : high - 62 >= 90 ? high : MID;
    });
    return out;
  }, [shots, track, D]);
  const k = at(frame);
  const Y = k >= 0 && Number.isFinite(spot[k]) ? spot[k] : MID;

  // 4. One group seen at a time, cut in and out, the rest of the text in the page, hidden.
  const serif = "'" + brand.displayFont + "', 'Gelasio', Georgia, serif";
  const hidden = { position: "absolute", left: 0, top: 0, opacity: 0, fontSize: 1, whiteSpace: "pre" };
  const p = told;
  return h(AbsoluteFill, null,
    p.lead ? h("span", { style: hidden }, p.lead) : null,
    p.items.map((g, gi) => {
      const span = p.times[gi];
      const on = Boolean(span) && frame >= span.from && frame < span.to;
      return h(React.Fragment, { key: "g" + gi },
        on
          ? h(FitText, { key: "w-" + gi + "-" + g.show, style: { position: "absolute", left: 140, top: Y - 52, width: 800, height: 104 }, innerStyle: { fontFamily: serif, fontWeight: 700, fontSize: 64, lineHeight: 1.15, color: "#fefaf6", textShadow: "0 2px 3px rgba(0,0,0,0.38), 0 0 12px rgba(0,0,0,0.24)", whiteSpace: "nowrap", textAlign: "center" } }, g.show)
          : h("span", { style: hidden }, g.show),
        g.after ? h("span", { style: hidden }, g.after) : null);
    }));
}`;

export const recette: EffectPiece = {
  key: "recette",
  version: 1,
  name: "Les gestes racontés",
  how: "sur quelques plans de ses gestes filmés téléphone posé (une étape coupée geste par geste dans le même plan), ses mots s'écrivent au milieu de l'image comme les sous-titres d'une voix : un petit groupe d'un à trois mots par plan, changé sur la coupe, en serif grasse d'un blanc chaud, sans boîte, jamais sur un visage ; puis le montage reprend.",
  needs: "des gestes filmés téléphone posé, de dessus ou de face, en plans courts (une recette, un bouquet monté, une coupe, une pièce qu'on façonne).",
  lays: "sur 2 à 8 plans de ses gestes à la suite, d'un demi-temps à deux temps chacun, une étape ou quelques étapes",
  shots: [2, 8],
  seconds: [2, 10],
  require: { files: 1, shot: { framing: ["close", "detail", "medium"], still: true, video: true } },
  texts: [
    {
      slot: "recit",
      want: "ce que montrent ses gestes, raconté comme par une voix, en minuscules, au tutoiement ou par leurs noms : un petit groupe d'un à trois mots par plan dessous, séparés par des virgules, dans l'ordre (une forme comme « farine, yaourt, une pincée de sel, tu pétris ») ; rien d'inventé",
      max: 90,
      required: true,
    },
  ],
  code: CODE,
};
