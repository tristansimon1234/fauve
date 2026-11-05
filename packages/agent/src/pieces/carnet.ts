import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Le hublot », the effect of « Ton produit raconté » (docs/fiches/carnet.md, effect 6; its whole Reel is
// skills/carnet.ts, version 1): over her talking shot (or its pieces, cut by the editor), the picture goes black for an
// instant (the original's 10 images), then at once her face in a round of light on black while she says what she loves
// or what she thinks; on the first word of her last phrase, the same picture 1,61 times closer in one image; then the
// montage resumes. Kept from the model: the round, an ellipse 49,4 % of the width and 1,36 times as tall (the original's
// spot on the floor), its edge falling into the black, set a little above the middle (its centre at 44 % of the height,
// so the engine's subtitles of what she says run under it); her face as the engine follows it (`track(frame, box).faces`,
// read once over its span) in the middle of the round, 42 % of its width; the jump 1,61 times closer, her face still in
// the middle, on the first word of her last phrase under it (`spoken`) when it comes 1,2 s after the round and 0,8 s
// before its end, else on a beat near 62 % of it (`punch`), never on a short one; without her face followed, the round
// filled with the top of her picture, where faces are. Left out: the model's other moments (its words very big, its
// number, its question, its pictures cut on her words), its own subtitles (the engine's stay under it), its music.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track, spoken }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const W = width;
  const H = height;
  const D = Math.max(1, durationInFrames);
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  const list = shots || [];
  // Its shots: those the engine counts under it (her talk, maybe cut into pieces by the editor).
  const counted = String((texts && texts.mine) || "").split(",").filter((x) => x !== "").map(Number).filter((i) => Number.isInteger(i) && list[i]);
  const mine = counted.length ? counted : list.map((s, i) => i).filter((i) => list[i].from < D && list[i].from + list[i].durationInFrames > 0);
  const shotAt = (f) => { let k = mine.length ? mine[0] : -1; for (const i of mine) if (list[i].from <= f) k = i; return k; };
  const cur = shotAt(frame);
  const LEAD = Math.round(Math.max(0, Math.min(D - 1, mark("lead", 10))));

  // 1. Its jump: on the first word of her last phrase under it (a pause of 8 images, or a sentence's end, starts one),
  // 1,2 s at least after the round shows and 0,8 s before its end; else on its fallback beat; never on a short one.
  const punch = React.useMemo(() => {
    const ws = (spoken || []).filter((w) => w && typeof w.w === "string" && Number.isFinite(w.from) && w.from >= 0 && w.from < D);
    const starts = ws.filter((w, i) => i === 0 || w.from - ws[i - 1].to >= 8 || /[.!?…]$/.test(String(ws[i - 1].w)));
    const last = starts[starts.length - 1];
    if (starts.length >= 2 && last.from - LEAD >= 36 && D - last.from >= 24) return Math.round(last.from);
    const m = mark("punch", -1);
    return m >= LEAD + 36 && D - m >= 24 ? Math.round(m) : -1;
  }, [spoken, D, LEAD]);

  // 2. Her face as the engine follows it, read once over its span: the round centred on it.
  const face = React.useMemo(() => {
    if (typeof track !== "function" || !mine.length) return null;
    const xs = [];
    const ys = [];
    const ws = [];
    for (let f = LEAD; f < D; f += 6) {
      const seen = track(f, { shot: shotAt(f), left: 0, top: 0, width: W, height: H }) || {};
      const fs = (seen.faces || []).filter((q) => q && q.width > 0 && Number.isFinite(q.x) && Number.isFinite(q.y));
      if (!fs.length) continue;
      const q = fs.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
      xs.push(q.x);
      ys.push(q.y);
      ws.push(q.width);
    }
    if (!xs.length) return null;
    const mid = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];
    return { x: mid(xs), y: mid(ys), w: mid(ws) };
  }, [track, D, LEAD, mine.join(",")]);

  // 3. The round: an ellipse 49,4 % of the width and 1,36 times as tall, its edge falling into the black, 1,61 times
  // larger after its jump; her picture in it, her face in its middle, 42 % of its width (else the top of her picture).
  if (frame < LEAD || cur < 0) return h(AbsoluteFill, { style: { backgroundColor: "#000000" } });
  const punched = punch > 0 && frame >= punch;
  const k = punched ? 1.61 : 1;
  const dw = W * 0.494 * k;
  const dh = dw * 1.36;
  const cx = W * (punched ? 0.51 : 0.505);
  const cy = H * (punched ? 0.45 : 0.44);
  const b = { left: cx - dw / 2, top: cy - dh / 2, width: dw, height: dh };
  const q = face || { x: W * 0.5, y: H * 0.38, w: W * 0.36 };
  let s = Math.max(0.8, Math.min(2.4, (W * 0.494 * 0.42) / Math.max(1, q.w))) * k;
  s = Math.max(s, dw / W, dh / H);
  const left = Math.min(0, Math.max(dw - W * s, dw / 2 - q.x * s));
  const top = Math.min(0, Math.max(dh - H * s, dh / 2 - q.y * s));
  const r = (v) => Math.round(v);
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } },
    h("div", { key: punched ? "round-p" : "round", style: { position: "absolute", left: r(b.left), top: r(b.top), width: r(dw), height: r(dh), borderRadius: "50%", overflow: "hidden", backgroundColor: "#000000" } },
      h(Footage, { key: "her", shot: cur, style: { position: "absolute", left: r(left), top: r(top), width: r(W * s), height: r(H * s) } }),
      h("div", { key: "rim", style: { position: "absolute", left: 0, top: 0, width: r(dw), height: r(dh), background: "radial-gradient(closest-side, rgba(0,0,0,0) 82%, rgba(0,0,0,0.5) 94%, rgba(0,0,0,0.92) 100%)" } })));
}`;

/** Its black first (frames): the original's 10 images, a seventh of a short one at most, 4 at least. */
export const carnetLead = (frames: number) => Math.max(4, Math.min(10, Math.round(frames / 7)));

/** Its fallback jump (frames from its start): the beat nearest 62 % of it, 1,2 s after the round and 0,8 s before its end, else none (−1). */
export function carnetPunch(frames: number, bpm: number): number {
  const lead = carnetLead(frames);
  const beat = (60 / bpm) * 30;
  const at = Math.round(Math.round((frames * 0.62) / beat) * beat);
  const fits = (f: number) => f >= lead + 36 && frames - f >= 24;
  if (fits(at)) return at;
  const near = Math.round(frames * 0.62);
  return fits(near) ? near : -1;
}

export const carnet: EffectPiece = {
  key: "carnet",
  version: 1,
  name: "Le hublot",
  how: "l'image passe au noir un instant, puis d'un coup son visage dans un rond de lumière sur du noir (une ellipse de la moitié de la largeur, un peu plus haute que large, son bord fondu dans le noir) pendant qu'elle parle ; sur le premier mot de sa dernière phrase, la même image 1,6 fois plus près, d'un coup ; puis le montage reprend.",
  needs: "une vidéo d'elle (ou de quelqu'un de l'équipe) qui parle face caméra, le visage bien éclairé, pendant qu'elle dit ce qu'elle aime ou ce qu'elle en pense.",
  lays: "sur son plan face caméra (ou ses morceaux coupés par le monteur) pendant une à trois phrases où elle dit ce qu'elle aime ou ce qu'elle pense, de 2 à 8 s, juste après un plan de ce dont elle parle",
  shots: [1, 4],
  seconds: [2, 8],
  require: { files: 1, shot: { framing: ["medium", "close"], person: true, video: true } },
  texts: [],
  spoken: true,
  timeline(input: PieceTimelineInput) {
    // Its black first and its fallback jump; its code jumps on her last phrase when it can read it.
    return { marks: { lead: carnetLead(input.frames), punch: carnetPunch(input.frames, input.bpm) } };
  },
  code: CODE,
};
