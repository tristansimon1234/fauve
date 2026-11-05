import type { EffectPiece } from "../pieces.ts";

// « Montage sport noir et blanc », the effect (its whole Reel is skills/nike.ts, written on its original: the sports
// edit in the left part of a tutorial, looked at image by image; no fiche of its own). Over a run of her shots with
// movement, the words' section of its Reel: each shot in a very contrasted black and white (its model's finish drawn
// here too, on its own shots only: its contrast, its grain, its dark corners), a word per shot in red condensed
// capitals at the middle of the frame, landing on its cut with two images in negative where the word is black; its
// first word lands through its opening strobe (two images red, three in negative, two red); one shot in four all red
// (multiplied), its word white; its quick shots held image by image, the jerky slow motion of a sports ad (Footage
// hold); its last gesture frozen on its last beat. Then the montage takes over, in colour. Fewer words than shots: a
// word on some cuts, the last one staying on; more: a word a beat. A word never sits on a face it can see (track): it
// goes up, or down, where the faces leave room. Its red, its condensed capitals (Big Shoulders Display, the model's
// cinema pair, unless her title face is condensed already) and its black and white are the effect's own; her own
// colour takes the red's place on her word. It leaves the rest of its Reel: its burst of later shots flashed ahead,
// its title on black, its black and its ending card. Nothing of the original's own: no swoosh, no slogan, her words.

/** Its red (the original's), its condensed capitals, and a quick shot (frames: a beat and an image at most, held image by image). */
const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: those that play during it, in order, each from its cut (the first one from its start).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  if (!mine.length) return null;
  const BEAT = Math.max(4, mark("beat", 18));
  const starts = mine.map((i) => Math.max(0, Math.round(shots[i].from)));
  const rank = starts.reduce((r, s, k) => (s <= frame ? k : r), 0);
  const cur = mine[rank];
  const shot = shots[cur];

  // Its red, or her own colour on her word when it is strong enough to hold on black and white (vivid, neither pale
  // nor near black); the red otherwise.
  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "")); return m ? parseInt(m[1], 16) : null; };
  const strong = (v) => {
    if (v === null) return false;
    const r = ((v >> 16) & 255) / 255;
    const g = ((v >> 8) & 255) / 255;
    const b = (v & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return sat >= 0.5 && lum >= 0.06 && lum <= 0.5;
  };
  const own = hex(brand.accent);
  const RED = setting("couleur", "rouge") === "sienne" && strong(own) ? "#" + own.toString(16).padStart(6, "0") : "#f2000c";

  // Her words between commas (or slashes, dots, lines); none of them: a word each. A word lands on a cut, spread over
  // its shots when she gave fewer, one a beat when she gave more (never more words than beats).
  const raw = setting("mots", "");
  const parts = raw.split(/[,;·|\/\n]/.test(raw) ? /\s*[,;·|\/\n]+\s*/ : /\s+/).map((w) => w.trim()).filter(Boolean);
  const beats = Math.max(1, Math.floor(durationInFrames / BEAT));
  const items = parts.slice(0, Math.max(starts.length, beats));
  const W = items.length;
  const S = starts.length;
  const lands = items.map((_, k) => (W <= S ? starts[Math.floor((k * S) / W)] : Math.round(Math.round((k * durationInFrames) / W / BEAT) * BEAT)));
  const current = lands.reduce((c, l, k) => (l <= frame ? k : c), -1);
  const since = current >= 0 ? frame - lands[current] : 99;

  // How each image looks: its first images through the strobe of the original's opening (two red, three in negative,
  // two red), each other word landing with two images in negative; one shot in four all red; else black and white.
  const STROBE = setting("entree", "strobo") !== "coupe";
  const flash = STROBE && frame < 7 ? (frame < 2 || frame >= 5 ? "red" : "negative") : since < 2 && !(STROBE && lands[current] === 0) ? "negative" : null;
  const look = flash || (rank % 4 === 2 ? "red" : "bw");

  // Its quick shots held image by image (the jerky slow motion of a sports ad); when none is quick, every other one.
  // Its last gesture frozen on its last beat, when it has played a beat by then (its timeline's mark).
  const quickOf = (i) => shots[i].durationInFrames <= Math.round(BEAT) + 1;
  const anyQuick = mine.some(quickOf);
  const FREEZE = mark("freeze", -1);
  const played = Math.round(FREEZE - shot.from);
  const hold = FREEZE > 0 && frame >= FREEZE && played >= Math.round(BEAT) && played >= 2 ? played : quickOf(cur) || (!anyQuick && rank % 2 === 1) ? 3 : 0;

  // Its look, measured on its model: black and white very contrasted (its own curve, then its finish's), the
  // negative the same way; the red multiplied over it; its grain changing every two images; dark corners. A dark shot
  // of hers (a gym at night, a backlit corner: its light read on her shot before the render, LightUnder) is lifted
  // before that curve, so it comes out contrasted rather than crushed to black; not read, the curve as it is.
  const light = LightUnder(shot, shot.from, { left: 0, top: 0, width, height });
  const lift = light && light.mean > 0.02 ? Math.max(0.9, Math.min(1.9, 0.45 / light.mean)) : 1;
  const BW = "grayscale(1) brightness(" + lift.toFixed(2) + ") contrast(1.45) brightness(0.9) contrast(1.4)";
  const NEGATIVE = "grayscale(1) brightness(" + lift.toFixed(2) + ") invert(1) contrast(1.3) brightness(1.08) contrast(1.4)";
  const full = { position: "absolute", left: 0, top: 0, width, height };
  const film = h("div", { key: "f" + cur, style: { ...full, overflow: "hidden", isolation: "isolate" } },
    h(Footage, { shot: cur, style: { ...full, filter: look === "negative" ? NEGATIVE : BW }, ...(hold > 1 ? { hold } : {}) }),
    look === "red" ? h(Tint, { color: RED, mode: "multiply" }) : null);
  const corners = h("div", { key: "v", style: { ...full, background: "radial-gradient(ellipse 80% 70% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.21) 100%)" } });
  const seed = Math.floor(frame / 2) % 97;
  const grainId = "nike-piece-grain-" + seed;
  const grain = h("svg", { key: "g", width: Math.round(width / 2), height: Math.round(height / 2), style: { ...full, opacity: 0.1, mixBlendMode: "overlay" }, "aria-hidden": "true" },
    h("filter", { id: grainId },
      h("feTurbulence", { type: "fractalNoise", baseFrequency: 0.85, numOctaves: 2, seed, stitchTiles: "stitch" }),
      h("feColorMatrix", { type: "saturate", values: "0" })),
    h("rect", { width: "100%", height: "100%", filter: "url(#" + grainId + ")" }));

  // Its word, in condensed capitals (hers when her title face is condensed, else the model's): red, white over a red
  // shot, black in negative; a long one on two lines as even as can be; a thin dark edge so it reads on any picture.
  const CONDENSED = /condensed|narrow|compressed|bebas|anton|oswald|league gothic|big shoulders|fjalla|teko|six caps|antonio|pathway gothic|alumni sans|staatliches|smooch sans|bayon/i;
  const face = String(brand.displayFont || "");
  const display = CONDENSED.test(face) ? "'" + face + "', 'Big Shoulders Display', 'Arial Narrow', sans-serif" : "'Big Shoulders Display', '" + face + "', 'Arial Narrow', sans-serif";
  const keep = (t) => String(t || "").replace(/(\d) (?=\d)/g, "$1 ");
  const stacked = (text) => {
    const words = text.split(/[ \t\n]+/).filter(Boolean);
    if (text.length <= 11 || words.length < 2) return text;
    let best = 1;
    const gap = (k) => Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
    for (let i = 1; i < words.length; i++) if (gap(i) < gap(best)) best = i;
    return words.slice(0, best).join(" ") + "\n" + words.slice(best).join(" ");
  };

  // Where its word goes: the middle of the frame, as the original's; up, then down, when a face it can see is there
  // while the word holds (its eyes, nose or mouth on the word's lines), so a word never sits on a face.
  const ROWS = [760, 300, 1040];
  const clear = (top, lines, f) => {
    const seen = typeof track === "function" ? track(f) : null;
    const faces = (seen && seen.faces) || [];
    const reach = lines * 95 + 40;
    return !faces.some((other) => {
      const p = other.points || {};
      return [p.right_eye, p.left_eye, p.nose, p.mouth].some((q) => q && q.x >= 120 && q.x <= width - 120 && Math.abs(q.y - (top + 200)) <= reach);
    });
  };
  const rowOf = (k) => {
    const from = lands[k];
    const to = k + 1 < lands.length ? lands[k + 1] : durationInFrames;
    const lines = stacked(keep(items[k])).indexOf("\n") >= 0 ? 2 : 1;
    const at = [from, Math.min(to - 1, from + 6), Math.round((from + to) / 2)];
    const top = ROWS.find((t) => at.every((f) => clear(t, lines, f)));
    return top === undefined ? ROWS[0] : top;
  };
  const ink = look === "negative" ? "#000000" : look === "red" ? "#ffffff" : RED;
  const edge = look === "negative" ? "none" : "0 0 2px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.5)";
  const word = current >= 0
    ? h(FitText, { key: "w" + current, style: { position: "absolute", left: 140, top: rowOf(current), width: 800, height: 400 }, innerStyle: { fontFamily: display, fontWeight: 800, fontSynthesis: "none", fontSize: 190, lineHeight: 1, letterSpacing: "0.005em", textTransform: "uppercase", whiteSpace: "pre", textAlign: "center", color: ink, textShadow: edge } }, stacked(keep(items[current])))
    : null;

  return h(AbsoluteFill, { style: { backgroundColor: "#000000", overflow: "hidden" } }, film, corners, grain, word);
}`;

/** The frames of a beat at a tempo (30 images a second). */
const beatFrames = (bpm: number) => (60 / bpm) * 30;

export const nike: EffectPiece = {
  key: "nike",
  version: 1,
  name: "Montage sport noir et blanc",
  how: "ses plans en noir et blanc très contrasté, avec du grain ; un mot en grand, en capitales rouges condensées, par plan au milieu de l'écran, chacun arrivant sur la coupe avec deux images en négatif (le premier dans un stroboscope rouge et négatif) ; un plan sur quatre tout rouge, ses plans rapides saccadés image par image, le dernier geste figé sur le dernier temps ; puis le montage reprend en couleur.",
  needs: "des vidéos avec du mouvement (un geste, un effort, un service en plein rush), filmées sans trop trembler, de près ou en plan moyen.",
  lays: "sur 3 à 8 de ses plans d'action coupés d'un ou deux temps chacun, un mot par plan, le dernier un geste fort qui se fige",
  shots: [3, 10],
  seconds: [2, 8],
  require: { files: 3, shot: { video: true } },
  texts: [
    {
      slot: "mots",
      want: "un mot ou un groupe de deux mots par plan dessous, séparés par des virgules, autant que de plans : les gestes, les moments ou les lieux de son métier (une forme comme « pétrir, façonner, cuire, servir »)",
      max: 70,
      required: true,
    },
  ],
  settings: [
    {
      name: "couleur",
      want: "la couleur de ses mots et de ses plans rouges",
      choices: [
        { value: "rouge", says: "le rouge de l'original" },
        { value: "sienne", says: "sa couleur à elle (celle de sa charte) quand elle est assez vive et foncée pour tenir sur le noir et blanc ; le rouge sinon" },
      ],
    },
    {
      name: "entree",
      want: "comment son premier mot arrive",
      choices: [
        { value: "strobo", says: "comme l'ouverture de l'original : deux images en rouge, trois en négatif, deux en rouge" },
        { value: "coupe", says: "comme les autres : deux images en négatif sur la coupe" },
      ],
    },
  ],
  // Its last gesture frozen on its last beat, when the shot playing then has played a beat by then (else it plays on).
  timeline({ frames, bpm, shots }) {
    const beat = beatFrames(bpm);
    const at = Math.round(frames - beat);
    const last = shots.find((s) => s.from <= at && s.from + s.frames > at);
    return last && at > 0 && at - last.from >= Math.round(beat) ? { marks: { freeze: at } } : {};
  },
  code: CODE,
  fonts: ["Big Shoulders Display"],
};
