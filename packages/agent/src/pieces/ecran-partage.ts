import type { EffectPiece } from "../pieces.ts";

// « Écran partagé titré », the effect (docs/fiches/ecran-partage.md, effects 1 to 5; its whole Reel is
// skills/ecran-partage.ts): for a moment, her shots go two by two into a card cut in two halves that touch, on black,
// still from its first image to its last: the gesture in one half (her or her team at work), what it gives in the other
// at the same moment (the dish set down, its last touch), both halves cutting together, never one alone. The editor
// cuts her shots one after the other; the effect lays them two by two on the same moment instead: over a pair's span
// (its two shots' time together), each half plays its own shot from the pair's first image (Footage at: the second one
// shown early, beside the first), slowed just enough to fill the pair (never under half its speed, its images blended
// as its skill's version 2 did; a passage too short holds its last image, what it gives), so both halves move all along
// and cut together on the pair's last image. An odd count takes one shot alone in the middle, as its skill's: a video's
// gesture plays in one half while the other holds its last image, what it gives; a photo alone is laid across the card.
// Two small titles in a classic book serif, white, one on each half, that answer each other (« Les artistes » /
// « L'art »), stay the whole effect, just under the middle of the card (side by side) or of each half (one above the
// other), with a tight dark edge and a soft shade so they read on a pale plate. Its layout follows her shots: the
// original's 4:3 card at the middle of the screen, halves side by side, when they are mostly vertical; one half above
// the other over the whole screen when they are horizontal; or as she asks (its « format »). Then the montage resumes
// full frame. Kept of its skill: its card, its margins and corners, its halves, its titles and their places, its pairs
// and its lone shot. Left: its music, its cuts' grid (the Reel's beats are the editor's), its casting and its ending card.

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  // Its shots: those that play during it, in order (one that only grazes it by a frame left out, as the engine counts
  // the shots under it), two by two in its halves.
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames - 1 && shots[i].from + shots[i].durationInFrames > 1);
  if (!mine.length) return null;
  const n = mine.length;

  // Its layout, as its shots are: the original's 4:3 card at the middle of the screen, its halves side by side (2:3),
  // when most of them are vertical; the card over the whole screen, one half above the other (9:8), when most are
  // horizontal; or as she asks: the card, side by side over the whole screen (9:32), one above the other.
  const format = word("format") || "auto";
  const wideShots = mine.filter((i) => (Number(shots[i].aspect) || 0.5625) > 1.15).length;
  const stacked = format === "empile" || (format === "auto" && wideShots * 2 > n);
  const boxed = format === "carte" || (format === "auto" && !stacked);
  const fh = boxed ? Math.round((width * 3) / 4) : height;
  const fy = boxed ? Math.round((height - fh) / 2) : 0;

  // 1. The card on pure black, still from start to end, as the original's: its margins (0,9 % of the width on the sides,
  // 1,8 % of the height above it, 1,5 % below), its rounded corners (2,8 % of its width); cut at 50 % by a straight line,
  // its two halves touching, square in the middle.
  const cx = Math.round(width * 0.009);
  const cy = fy + Math.round(fh * 0.018);
  const cw = width - 2 * cx;
  const ch = fh - Math.round(fh * 0.018) - Math.round(fh * 0.015);
  const radius = Math.round(cw * 0.028);
  const first = stacked ? { x: 0, y: 0, w: cw, h: Math.round(ch / 2) } : { x: 0, y: 0, w: Math.round(cw / 2), h: ch };
  const second = stacked ? { x: 0, y: first.h, w: cw, h: ch - first.h } : { x: first.w, y: 0, w: cw - first.w, h: ch };

  // Its pairs, in order: two shots that follow each other, laid on the same moment (the gesture, then what it gives
  // beside it); with an odd count, one shot alone in the middle. Two shots that already start on the same image (laid
  // side by side by the montage) are a pair as they are, each at its own moment and speed.
  const ends = (i) => shots[i].from + shots[i].durationInFrames;
  const together = mine.some((i, k) => k > 0 && Math.abs(shots[i].from - shots[mine[k - 1]].from) <= 1);
  const pairs = [];
  const pair = (a, b) => pairs.push({ a, b, from: shots[a].from, to: b >= 0 ? Math.max(ends(a), ends(b)) : ends(a) });
  if (together) {
    for (let k = 0; k < n; ) {
      const b = k + 1 < n && Math.abs(shots[mine[k + 1]].from - shots[mine[k]].from) <= 1 ? mine[k + 1] : -1;
      pair(mine[k], b);
      k += b >= 0 ? 2 : 1;
    }
  } else {
    const full = Math.floor(n / 2);
    let k = 0;
    if (!full) pair(mine[0], -1);
    for (let p = 0; p < full; p++) {
      if (n % 2 === 1 && p === Math.floor(full / 2)) pair(mine[k++], -1);
      pair(mine[k], mine[k + 1]);
      k += 2;
    }
  }
  const now = pairs.find((p) => frame >= p.from && frame < p.to) || pairs[pairs.length - 1];

  // Each half plays its own shot from its pair's first image (a video; a photo stays still), slowed just enough to fill
  // the pair, never under half its speed, an image between two blended; a passage too short then holds its last image.
  // A shot alone plays at its own moment and speed. « held »: its last image, what it gives. Nothing moves, zooms nor
  // slides in: cuts only.
  const pane = (key, k, box, held) => {
    const s = shots[k];
    const style = { position: "absolute", left: 0, top: 0, width: box.w, height: box.h };
    let inside = h(Footage, { shot: k, style });
    if (held && s.kind === "video") inside = h(Footage, { shot: k, at: frame - s.durationInFrames, style });
    else if (s.kind === "video" && !together && now.b >= 0) {
      const L = Math.max(1, s.durationInFrames);
      const speed = Math.min(1, Math.max(0.5, L / Math.max(1, now.to - now.from)));
      const t = Math.min(L - 1, Math.max(0, (frame - now.from) * speed));
      const at = Math.floor(t);
      const mix = Math.round((t - at) * 100) / 100;
      inside = [
        h(Footage, { key: "a", shot: k, at: frame - at, style }),
        mix > 0.01 && at < L - 1 ? h(Footage, { key: "b", shot: k, at: frame - at - 1, style: { ...style, opacity: mix } }) : null,
      ];
    }
    return h("div", { key, style: { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden" } }, inside);
  };
  // A shot alone: a video's gesture plays in one half while the other holds its last image; a photo across the card.
  const alone = now.b < 0;
  const still = alone && shots[now.a].kind !== "video";
  const panes = still
    ? pane("p" + now.a, now.a, { x: 0, y: 0, w: cw, h: ch }, false)
    : alone
      ? [pane("p" + now.a, now.a, first, false), pane("q" + now.a, now.a, second, true)]
      : [pane("p" + now.a, now.a, first, false), pane("q" + now.b, now.b, second, false)];
  const card = h("div", { key: "card", style: { position: "absolute", left: cx, top: cy, width: cw, height: ch, borderRadius: radius, overflow: "hidden", backgroundColor: "#000000" } }, panes);

  // 2. Its two small titles, on the card, not on its halves, still from its first image to its last: a classic book
  // serif, roman, its first letter a capital, white, with a tight dark edge and a soft shade so they read on a pale plate
  // too (the original's have none: « The Art » read badly on its white plates); 50 px (the original's 42 would be under
  // the check's 48). Side by side, just under the middle of the card (54 % of its height), at 43 % and 51 % of their
  // halves (one on the person, the other on what she makes), the right one left of the apps' buttons; one above the
  // other, centred, just under the middle of the upper half (56 %, on the person rather than her face), a little above
  // the middle of the lower one (44 %, clear of the apps' caption). A long title goes on two lines rather than
  // shrinking; a word is never cut at its hyphen.
  const display = "'" + brand.displayFont + "', 'EB Garamond', Georgia, serif";
  // (A dense edge of a pixel or two, dark on any picture: on white icing its letters still have a border; a big blur would look cheap.)
  const shade = "0 0 1px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.45), 0 2px 14px rgba(0,0,0,0.3)";
  const SIZE = 50;
  const LINE = 1.15;
  const BOX = Math.round(SIZE * LINE * 2 + 12);
  const capital = (s) => (s ? s.charAt(0).toLocaleUpperCase("fr") + s.slice(1) : s);
  const unbroken = (text) => h("span", { style: { display: "block" } }, String(text || "").split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : h("span", { key: i, style: { whiteSpace: "nowrap" } }, w))));
  const buttons = width - 150;
  // Its width from its letters (a book serif's letter is about half its size), centred on its place within its room.
  const title = (text, key, centre, y, lo, hi) => {
    if (!text) return null;
    const w = Math.min(hi - lo, Math.round(text.length * SIZE * 0.46) + 24);
    const left = Math.max(lo, Math.min(hi - w, Math.round(centre - w / 2)));
    return h(FitText, { key, style: { position: "absolute", left, top: Math.round(y - BOX / 2), width: w, height: BOX }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: SIZE, lineHeight: LINE, letterSpacing: "0.005em", color: "#ffffff", textAlign: "center", whiteSpace: "normal", textWrap: "balance", textShadow: shade } }, unbroken(capital(text)));
  };
  const room = (y) => (y + BOX / 2 > height / 2 ? buttons : width - 50);
  const person = word("personne");
  const result = word("resultat");
  const titles = stacked
    ? [
        title(person, "t0", width / 2, cy + Math.round(first.h * 0.56), 50, room(cy + first.h * 0.56)),
        title(result, "t1", width / 2, cy + second.y + Math.round(second.h * 0.44), 50, room(cy + second.y + second.h * 0.44)),
      ]
    : [
        title(person, "t0", cx + Math.round(first.w * 0.43), cy + Math.round(ch * 0.54), 50, cx + first.w - 20),
        title(result, "t1", cx + second.x + Math.round(second.w * 0.51), cy + Math.round(ch * 0.54), cx + second.x + 20, room(cy + ch * 0.54)),
      ];

  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, card, titles);
}`;

export const ecranPartage: EffectPiece = {
  key: "ecran-partage",
  version: 1,
  name: "Écran partagé titré",
  how: "une carte aux coins arrondis sur du noir, coupée en deux moitiés qui se touchent : dans l'une le geste (elle ou son équipe au travail), dans l'autre, au même moment, ce qu'il donne ; ses plans y passent deux par deux, chaque moitié jouant le sien en même temps, les deux coupées ensemble ; deux petits titres en serif blanc, un sur chaque moitié, qui se répondent (« Les artistes » / « L'art »), tenus tout du long ; côte à côte quand ses vidéos sont verticales, l'une sur l'autre quand elles sont horizontales ; puis le montage reprend en plein écran.",
  needs: "des vidéos deux par deux : quelqu'un au travail (ses mains, son geste, la caméra posée), puis ce que ce geste donne, posé devant la caméra ou qui reçoit sa dernière touche (le plat, la coupe, le bouquet).",
  lays: "sur 2 à 8 de ses plans, par paires (le geste, puis ce qu'il donne), chacun d'un ou deux temps : les deux plans d'une paire se jouent ensemble, chacun ralenti jusqu'à la moitié de sa vitesse pour tenir toute la paire",
  shots: [2, 8],
  seconds: [2.4, 9],
  require: { files: 2, shot: { person: true, video: true } },
  texts: [
    {
      slot: "personne",
      want: "le petit titre de la moitié de la personne au travail : qui fait, en 1 à 3 mots (une forme comme « Les artistes », « Les fleuristes », « L'atelier »)",
      max: 16,
      required: true,
    },
    {
      slot: "resultat",
      want: "le petit titre de la moitié du résultat, qui répond au premier, souvent en le raccourcissant : ce que ça donne, en 1 à 3 mots (« L'art » pour « Les artistes », « Les fleurs » pour « Les fleuristes », « L'œuvre » pour « L'atelier »)",
      max: 16,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "la mise en page : la carte de l'original, ses deux moitiés côte à côte sur tout l'écran, ou l'une sur l'autre",
      choices: [
        { value: "auto", says: "comme ses vidéos : la carte de l'original quand elles sont verticales, les deux moitiés l'une sur l'autre quand elles sont horizontales" },
        { value: "carte", says: "la carte 4:3 de l'original au milieu de l'écran, sur du noir, ses deux moitiés côte à côte" },
        { value: "plein-ecran", says: "deux moitiés côte à côte, hautes et étroites, sur tout l'écran" },
        { value: "empile", says: "deux moitiés l'une sur l'autre sur tout l'écran : la personne en haut, le résultat en bas" },
      ],
    },
  ],
  code: CODE,
};
