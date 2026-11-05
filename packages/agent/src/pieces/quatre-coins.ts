import type { EffectPiece, PieceTimelineInput } from "../pieces.ts";

// « Mots aux quatre coins », the effect (docs/fiches/quatre-coins.md, effect 1; its whole Reel is skills/quatre-coins.ts):
// over one still, lively shot of her place, a sentence lands a piece at a time on the frame's edges, each piece cut in
// where it stays (no fade, no slide, nothing moves when the next one lands), every three quarters of a beat, the first
// two half a beat apart: its first words along the top (left, a third in, right), her name and her place on the middle
// row (left, right), a line along the bottom (her address); small cream lower case, the five words at one size, the
// bottom line 0,76 of it, no shadow nor edge; the whole sentence held, and every word goes at once on the cut, the
// effect's last image. Kept of its skill: its places as shares of her picture (the top row's capitals at 7 %, the middle
// row's line at 56 %, the bottom one at 90 %, 40 px from the sides, the second word of the top a third in), its sizes,
// its cream, its beats, its format (her shot in width whole in a 16:9 band on black as the original, her upright shot
// full frame, the montage's own). Made for any Reel: its words in her text face (the original's small grotesque, not a
// display face); tighter on its beats when its span is short (half beats, then quarters), so the sentence is always
// read whole before the cut; its middle row moved to the nearest share clear of a face seen there; its halo dosed by
// the light read under each word (none on a dark edge, as the original's letters; a soft dark one on a bright edge, its
// fiche's fallback). Left to its Reel: its music holding its
// breath (bass and kick out) from the whole sentence to the cut, which an effect cannot do (it plays on the Reel's
// music as it is), its ten shots of the place's life, her front and her name alone at the end. Nothing of the original's
// own (its café's name, its ®, its address).

/** The original's grid (beats from its start): its words every three quarters of a beat, the first two half a beat apart; its sentence read 2,4 s whole before the cut. */
const GRIDS = [
  { first: 0.75, gaps: [0.5, 0.75, 0.75, 0.75, 0.75], read: 2.4 },
  { first: 0.5, gaps: [0.5, 0.5, 0.5, 0.5, 0.5], read: 2 },
  { first: 0.5, gaps: [0.25, 0.5, 0.25, 0.5, 0.25], read: 1.6 },
  // A slow tempo on a short span (a beat of a second at 60 BPM): every quarter beat.
  { first: 0.25, gaps: [0.25, 0.25, 0.25, 0.25, 0.25], read: 1.6 },
];

/** Its pieces, in the order they land: its first words (three at most, the rest with the third), her name, her place, its bottom line (those it has). */
export function quatreCoinsPieces(words: Record<string, string>): string[] {
  const first = (words.debut ?? "").split(/\s+/).filter(Boolean);
  const top = first.length > 3 ? 3 : first.length;
  return [...Array.from({ length: top }, (_, i) => `top${i}`), ...(["nom", "lieu", "adresse"] as const).filter((k) => (words[k] ?? "").trim())];
}

/**
 * When each of its pieces lands (frames from its start) for a span and a tempo: on the original's grid when its
 * sentence then reads 2,4 s whole before the cut, else every half beat (read 2 s), else on quarters and halves, else
 * every quarter (1,6 s); a span too short even for that (far under its shortest) lands its last word 1,2 s before the
 * end (in its first 60 % at most).
 */
export function quatreCoinsLandings(frames: number, bpm: number, count: number): number[] {
  const beat = (60 / Math.min(140, Math.max(60, bpm))) * 30;
  const n = Math.max(1, Math.min(6, count));
  const on = (g: (typeof GRIDS)[number]) => {
    const beats = [g.first];
    for (let k = 1; k < n; k++) beats.push(beats[k - 1]! + g.gaps[k - 1]!);
    return beats.map((b) => Math.round(b * beat));
  };
  for (const g of GRIDS) {
    const at = on(g);
    if (at.at(-1)! + g.read * 30 <= frames) return at;
  }
  const at = on(GRIDS.at(-1)!);
  const k = Math.max(1, Math.min(frames - 36, frames * 0.6)) / Math.max(1, at.at(-1)!);
  return at.map((f) => Math.max(1, Math.round(f * k)));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts, track }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const D = durationInFrames;
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  // Its shots: those that play during it; her place is the first of them (its words sit on its edges).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < D && shots[i].from + shots[i].durationInFrames > 0);
  const seenFor = (i) => Math.min(D, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const ground = mine.length ? (mine.find((i) => seenFor(i) > 2) ?? mine[0]) : -1;
  const shot = ground >= 0 ? shots[ground] : null;

  // 1. Its frame: her shot in width whole in a 16:9 band on black as the original (or when she asks), playing as
  // filmed; upright, her shot full frame, the montage's own under it (nothing drawn but the words).
  const a = shot ? Number(shot.aspect) || 0.5625 : 0.5625;
  const format = setting("format", "auto");
  const wide = format === "horizontal" || (format === "auto" && a > 1.15);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const laid = { left: 0, top: by, width: bw, height: bh };
  const film = wide && shot
    ? h("div", { key: "film", style: { position: "absolute", left: 0, top: 0, width, height, backgroundColor: "#000000" } }, h(Footage, { shot: ground, style: laid }))
    : null;

  // Its words: small words in her text face (the original's semi-bold tight grotesque), in a cream, never white (the
  // original's #E7E2CC); the first word with its capital (the original's « A »), her name and her place in lower case,
  // the bottom line as she writes it.
  const face = "'" + brand.bodyFont + "', 'Inter Tight', 'Inter', sans-serif";
  const CREAM = "#E7E2CC";
  const low = (s) => String(s || "").toLocaleLowerCase("fr");
  // A phone number, a postcode or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  const first = word("debut").split(/\s+/).filter(Boolean);
  const pieces = first.length > 3 ? [first[0], first[1], first.slice(2).join(" ")] : first;
  const heads = pieces.map((w, i) => (i ? low(w) : w.charAt(0).toLocaleUpperCase("fr") + low(w.slice(1))));
  const nameWord = low(word("nom"));
  const placeWord = low(word("lieu"));
  const address = word("adresse");
  if (!heads.length && !nameWord && !placeWord && !address) return h(AbsoluteFill, { style: { pointerEvents: "none" } }, film);

  // When each piece lands (frames from its start), in reading order, from its timeline; else the original's grid.
  const BEAT = Math.max(6, mark("beat", 18));
  const GRID = [0.75, 1.25, 2, 2.75, 3.5, 4.25];
  const order = [...heads.map((_, i) => "top" + i), ...(nameWord ? ["nom"] : []), ...(placeWord ? ["lieu"] : []), ...(address ? ["adresse"] : [])];
  const at = {};
  order.forEach((key, k) => { at[key] = mark("t" + k, Math.round(GRID[Math.min(k, 5)] * BEAT)); });
  const seen = (key) => (frame >= at[key] ? 1 : 0);

  // 2. Its places, shares of her picture: the top row's capitals at 7 % of its height, the middle row's line at 56 %,
  // the bottom one's at 90 %; full frame, of the part above the apps' caption (its lower fifth). 40 px from the sides
  // (the original's 3 %), left of the apps' buttons for a row below the middle of the screen.
  const tfH = wide ? bh : Math.round(height * 0.81);
  const capTop = by + 0.07 * tfH;
  const lowBase = by + 0.9 * tfH;
  const L = 40;
  const edge = (bottom) => (bottom > height / 2 - 12 ? width - 140 : width - 40);
  // The five words at one size (the original's capitals, 5,1 % of its width: 76 px at 1080), the bottom line 0,76 of it;
  // smaller together when her words are long (a grotesque's letter is about half its size), never under 48 px.
  const SIZE = Math.round(bw * 0.07);
  const em = (s) => Array.from(String(s || "")).length * 0.53;
  const GAP = 0.6;
  const topW = edge(capTop + 0.97 * SIZE) - L;
  const lowW = edge(lowBase + 0.25 * SIZE) - L;
  const third = Math.round(bw * 0.34) - L;
  const fitTop = heads.length === 3
    ? Math.min((topW - third) / (em(heads[1]) + GAP + em(heads[2])), topW / (em(heads[0]) + em(heads[1]) + em(heads[2]) + 2 * GAP))
    : heads.length === 2 ? topW / (em(heads[0]) + GAP + em(heads[1])) : heads.length ? topW / em(heads[0]) : SIZE;
  const midBaseAt = (share) => by + share * tfH;
  const midWAt = (share) => edge(midBaseAt(share) + 0.25 * SIZE) - L;
  const fitMidAt = (share) => midWAt(share) / Math.max(1, em(nameWord) + (nameWord && placeWord ? GAP : 0) + em(placeWord));
  const S1 = Math.floor(Math.min(SIZE, fitTop));

  // Its middle row a little under the middle of her picture as the original, or, when a face shows under her name or
  // her place there, the nearest share clear of it (the faces seen under it while it shows).
  const faceAt = (f) => {
    if (typeof track !== "function") return [];
    const got = wide && shot ? track(f, { shot: ground, left: 0, top: by, width: bw, height: bh }) : track(f);
    return ((got && got.faces) || []).map((face) => ({ x0: face.x - face.width / 2, x1: face.x + face.width / 2, y0: face.y - face.height / 2, y1: face.y + face.height / 2 }));
  };
  const samples = [];
  for (let f = Math.min(at[order[0]] || 0, D - 1); f < D; f += 8) samples.push(faceAt(f));
  const hits = (share) => {
    const s = Math.min(S1, fitMidAt(share));
    const y0 = midBaseAt(share) - 1.11 * s;
    const y1 = midBaseAt(share) + 0.19 * s;
    const spans = [nameWord ? [L, L + em(nameWord) * s] : null, placeWord ? [L + midWAt(share) - em(placeWord) * s, L + midWAt(share)] : null].filter(Boolean);
    return samples.filter((faces) => faces.some((b) => b.y1 >= y0 - 10 && b.y0 <= y1 + 10 && spans.some((x) => b.x1 >= x[0] - 10 && b.x0 <= x[1] + 10))).length;
  };
  const SHARES = [0.56, 0.62, 0.5, 0.68, 0.44];
  const midShare = nameWord || placeWord ? SHARES.reduce((best, s) => (hits(s) < hits(best) ? s : best)) : 0.56;
  const midBase = midBaseAt(midShare);
  const midW = midWAt(midShare);
  const S = Math.max(48, Math.floor(Math.min(S1, fitMidAt(midShare))));
  const A = Math.max(48, Math.round(S * 0.76));

  // Its halo by the light under each word: none on a dark edge (the original's letters, no shadow nor edge), a soft
  // dark one on a bright one (a pale wall, a window, a white cup), the skill's soft halo when the light was not read.
  const halo = (x0, x1, y0, y1) => {
    const r = shot ? LightUnder(shot, Math.max(0, Math.round(shot.from)), laid, { x: Math.max(0, x0), y: y0, w: Math.max(1, Math.min(width, x1) - Math.max(0, x0)), h: y1 - y0 }) : null;
    if (!r) return "0 0 0.5em rgba(0,0,0,0.3)";
    const k = Math.max(0, Math.min(1, (r.high - 0.45) / 0.3));
    if (k <= 0.02) return "none";
    return "0 0 0.5em rgba(0,0,0," + (0.3 + 0.25 * k).toFixed(2) + ")" + (k > 0.5 ? ", 0 1px 3px rgba(0,0,0," + (0.5 * k).toFixed(2) + ")" : "");
  };
  const type = { fontFamily: face, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em", color: CREAM, whiteSpace: "nowrap" };

  // 3. The sentence on the edges, a piece at a time, cut in: each word set at once where it stays, laid out from its
  // first image so nothing moves when one lands; all go at once on the cut (its last image). Each row is one box
  // (smaller as a whole if its words do not fit); a line never runs under the apps' buttons.
  const topAt = heads.map((_, i) => "top" + i);
  const tY = Math.round(capTop - 0.19 * S);
  // Where each of its top words sits (left, a third in, right; with two, left and right), for the light under it.
  const topX = (i) => (i === 0 ? L : heads.length === 3 && i === 1 ? L + third : L + topW - em(heads[i]) * S);
  const topRow = heads.length
    ? h(FitText, { key: "top", style: { position: "absolute", left: L, top: tY, width: topW, height: Math.round(1.3 * S) }, innerStyle: { ...type, fontSize: S, justifyContent: "flex-start", alignItems: "stretch" } },
        h("div", { style: { display: "grid", gridTemplateColumns: "minmax(max-content, " + ((100 * third) / topW).toFixed(2) + "%) minmax(max-content, 1fr) max-content", alignItems: "baseline", justifyItems: "start", textAlign: "left" } },
          heads.map((w, i) => h("span", { key: i, style: { gridColumn: heads.length === 2 && i === 1 ? 3 : i + 1, paddingRight: i < heads.length - 1 ? GAP + "em" : 0, opacity: seen(topAt[i]), textShadow: halo(topX(i), topX(i) + em(w) * S, tY, tY + 1.3 * S) } }, w))))
    : null;
  // Her name on the left, her place on the right.
  const mY = Math.round(midBase + 0.19 * S - 1.3 * S);
  const midRow = nameWord || placeWord
    ? h(FitText, { key: "mid", style: { position: "absolute", left: L, top: mY, width: midW, height: Math.round(1.3 * S) }, innerStyle: { ...type, fontSize: S, justifyContent: "flex-end", alignItems: "stretch" } },
        h("div", { style: { display: "flex", justifyContent: nameWord ? "space-between" : "flex-end", alignItems: "baseline", gap: GAP + "em" } },
          nameWord ? h("span", { key: "n", style: { opacity: seen("nom"), textShadow: halo(L, L + em(nameWord) * S, mY, mY + 1.3 * S) } }, nameWord) : null,
          placeWord ? h("span", { key: "p", style: { opacity: seen("lieu"), textShadow: halo(L + midW - em(placeWord) * S, L + midW, mY, mY + 1.3 * S) } }, placeWord) : null))
    : null;
  // Its line along the bottom, on one line, as written.
  const bY = Math.round(lowBase + 0.19 * A - 1.3 * A);
  const lowRow = address
    ? h(FitText, { key: "low", style: { position: "absolute", left: L, top: bY, width: lowW, height: Math.round(1.3 * A) }, innerStyle: { ...type, fontSize: A, justifyContent: "flex-end", alignItems: "flex-start", textAlign: "left" } },
        h("span", { style: { opacity: seen("adresse"), textShadow: halo(L, L + em(address) * A, bY, bY + 1.3 * A) } }, keep(address)))
    : null;

  return h(AbsoluteFill, { style: { pointerEvents: "none" } }, film, topRow, midRow, lowRow);
}`;

export const quatreCoins: EffectPiece = {
  key: "quatre-coins",
  version: 1,
  name: "Mots aux quatre coins",
  how: "sur un plan fixe et vivant de son lieu, une phrase se pose mot à mot sur les bords du cadre, un mot tous les trois quarts de temps, en petites minuscules crème toutes à la même taille, sans ombre : ses premiers mots en haut (à gauche, au tiers, à droite), son nom au milieu à gauche et son quartier au milieu à droite, une ligne en bas (son adresse) ; toute la phrase reste, puis part d'un coup sur la coupe ; posée en 16:9 sur du noir quand sa vidéo est horizontale.",
  needs: "un plan fixe et vivant de son lieu, téléphone posé, assez large (quelqu'un au travail un peu à gauche du centre), aux bords calmes et plutôt sombres (un mur, une étagère, une vitre) où les mots se posent, 4 s au moins ; pas un grand ciel clair.",
  lays: "sur un seul plan, l'ouverture fixe de son lieu, dès le début du plan ; la phrase part avec la coupe",
  shots: [1, 1],
  seconds: [4, 7],
  require: { files: 1, shot: { framing: ["wide", "medium"], still: true, person: true, video: true } },
  texts: [
    { slot: "debut", want: "1 à 3 petits mots qui ouvrent la phrase, posés en haut à gauche, au tiers et à droite (une forme comme « un matin chez », « un samedi au », « une journée chez ») ; chacun court", max: 24, required: true },
    { slot: "nom", want: "son nom (le mot qui la distingue s'il est long : « Farine » pour « Maison Farine »), posé au milieu à gauche ; il s'écrit en minuscules", max: 14, required: true },
    { slot: "lieu", want: "son quartier ou sa ville quand on les sait, sinon ce qu'elle est en un mot (« fleuriste », « atelier ») ; posé au milieu à droite, en minuscules", max: 12, required: false },
    { slot: "adresse", want: "une ligne posée en bas, sur une seule ligne : son adresse quand on la sait, sinon un repère vrai qu'on sait (« ouvert dès 8 h »), sinon ce qu'elle fait en quelques mots (« fleurs de saison ») ; rien d'inventé", max: 28, required: false },
  ],
  settings: [
    {
      name: "format",
      want: "le format : comme sa vidéo, horizontal comme l'original, ou vertical plein écran",
      choices: [
        { value: "auto", says: "comme sa vidéo (horizontale : en 16:9 sur du noir ; verticale : plein écran)" },
        { value: "horizontal", says: "horizontal 16:9 sur du noir, comme l'original, les mots sur les bords de l'image" },
        { value: "vertical", says: "vertical plein écran, les mots en haut, au milieu et en bas du cadre" },
      ],
    },
  ],
  timeline({ frames, bpm, words }: PieceTimelineInput) {
    const at = quatreCoinsLandings(frames, bpm, quatreCoinsPieces(words).length);
    return { marks: Object.fromEntries(at.map((f, k) => [`t${k}`, f])) };
  },
  code: CODE,
};
