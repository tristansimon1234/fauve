import { beatSpans, toFrame, type MontageSkill } from "../skills.ts";

// « Un an de plus », version 1, written on its original's fiche (docs/fiches/aventure.md: a travel creator's year in
// 46,9 s, measured image by image at 30 i/s, its counter in close-ups, its sound by bands; Tristan: « c'est un effet que
// l'on veut pouvoir faire, pas exactement reproduire l'image »). Her year told as an adventure film on a galloping
// acoustic folk at 134,87 BPM: every length below is in beats of its cuts' grid, so its cuts fall where the original's do
// (1,4 image off on average) and stay on the beat when shots are left out. Its five parts:
//   the opening  three quick shots, each cut hidden behind something dark passing right before the lens, its music
//                without its bass; the bass drops on her strongest shot, close up, and her counter is laid on it in
//                condensed capitals, white and translucent (« 4 ANS »): one beat later its number takes one more (« 5
//                ANS ») and swells for three images; its colours fill the lens, the counter stays over the next cut (a
//                crowd) and goes at once three beats after it came;
//   the rush     her moments a shot every two beats, its cuts hidden (a whip, smoke filling the frame, a fabric right
//                before the lens), a plunge into water where the music is muffled until the shot back in the open air;
//   the blow     a hard moment in four shots, darker (the pictures, never a grade);
//   the comeback a big setting, a long shot that turns, an object shown then the same elsewhere as water rises from the
//                bottom of the frame, a profile dissolving into a light for a second, something fast after a whip;
//   her people   coming towards the camera, a group photo, hugs, the last shot without the bass, faded out.
// Its original lasts 46,9 s: seven of its 51 shots are left out (shots that repeat another: the temple from the air, the
// fish seen wide, the boat, the valley, the friends in a van, the man at a rail, the notebook on the rocks), its longest
// 41 s, 42,8 with its ending card, never past 45 at its slowest tempo. Fewer shots leave out shots of its middle, never
// its opening, its counter, its plunge, its blow, its rising water, its dissolve nor its end. Full frame as her videos
// are, or whole in a 16:9 band on black when most of hers are horizontal (Tristan: « format par défaut [comme ses
// vidéos], et changement à la demande du user »); a photo stays still, a video plays. Nothing of the original's own: its
// word (« LAP », its creator's laps of the sun), his age, his trips, his accident.

const BPM = 134.87;
/** How each shot comes in, read by its code (« t1 », « t2 »… for her shots): a cut, or one the original hides. */
const CUT = 0;
const DARK = 1;
const NIGHT = 2;
const FILL = 3;
const SMOKE = 4;
const WHIP = 5;
const VEIL = 6;
const PLUNGE = 7;
const RISE = 8;
const DISSOLVE = 9;
/**
 * Its 44 shots kept from the original's 51 (its « roles »), in order: each one's length in beats of its cuts' grid (a
 * quarter beat apart at most from the original's), how it comes in, and what it wants (French, for the filler: what it
 * wants, else what does).
 */
const ROLES: [number, number, string][] = [
  [0.75, CUT, "le plan qui ouvre, un tiers de seconde : son lieu en contre-plongée, sa façade ou son enseigne contre le ciel ; sinon le plus beau plan de son lieu"],
  [1, DARK, "sa rue ou son quartier, la caméra qui bouge ou recule un peu (quelque chose de sombre passe devant l'objectif sur la coupe, dessiné s'il n'y en a pas) ; sinon un plan de son lieu"],
  [1, CUT, "un plan du soir ou de nuit qui passe et plonge dans le noir : une voiture, un vélo, des phares, une vitrine éclairée ; sinon un plan sombre qui bouge"],
  [2, NIGHT, "un détail qui sort de l'ombre au ralenti, de très près : un tissu, une main, des pas, un geste de son métier ; sinon un gros plan dans la pénombre"],
  [2.5, CUT, "LE plan fort où son compteur se pose au milieu, 1,1 s : un visage ou un sujet de près au milieu de l'image dans un moment fort, qui remplit l'image à la fin si possible (de la farine, des confettis, de la vapeur, de la poudre de couleur, un éclat de rire, un toast) ; sinon le plus fort de ses gros plans, au ralenti si possible"],
  [0.75, FILL, "du monde en mouvement, flou, de près : une foule, une fête, ses clients, un service en plein rush ; sinon un plan qui bouge vite"],
  [1.25, CUT, "quelqu'un qui porte, aide ou fait rire quelqu'un, dans la rue ou dans son lieu, en plein jour ; sinon quelqu'un en mouvement"],
  [4, WHIP, "quelque chose qui passe devant au ralenti (un véhicule, quelqu'un, un plat porté), puis de la fumée, de la vapeur ou de la farine qui remplit l'image (un fouet de la caméra au début si elle en a un) ; sinon un plan qui bouge, 1,8 s"],
  [2.5, SMOKE, "un visage qui sort de la fumée, de la vapeur ou de la poussière et qui sourit ; sinon un portrait souriant, de près"],
  [1.25, CUT, "un animal, une plante ou un détail de près devant un grand décor ; sinon un gros plan calme"],
  [2.75, VEIL, "quelqu'un de près qui s'écarte de l'objectif et dévoile un grand décor (un vêtement, un tablier ou une main passe tout contre l'objectif au début) ; sinon quelqu'un devant son lieu"],
  [1.75, CUT, "une vue d'en haut ou de très loin : son quartier, la mer, la ville, sa terrasse vue du dessus ; sinon un plan large"],
  [2.25, CUT, "quelqu'un qu'on suit de dos qui marche dans un lieu (une allée, un couloir, sa boutique) ; sinon quelqu'un qui marche"],
  [1, CUT, "un plan large et calme d'une personne dans un décor ; sinon un plan large de son lieu"],
  [1, CUT, "les mêmes de plus près, ou deux personnes qui marchent ensemble ; sinon un plan moyen"],
  [2.25, CUT, "de l'eau ou un liquide qui coule ou tombe (une fontaine, un robinet, un café qu'on verse, la mer), la caméra qui le suit vers le bas ; sinon quelque chose qu'on verse"],
  [1.5, PLUNGE, "dedans ou dessous : sous l'eau, des bulles, le fond d'un verre ou d'une tasse, une piscine (la musique y est étouffée comme sous l'eau) ; sinon un plan calme et bleuté"],
  [1, CUT, "un visage de très près, calme : sous l'eau, mouillé, derrière des lunettes ou une vitre ; sinon un visage de près"],
  [2, CUT, "une vue d'en haut, claire et vaste (une plage, une place, un parc, une terrasse) : la musique revient à l'air libre ; sinon un plan large et lumineux"],
  [2, CUT, "un selfie qui tourne, un visage qui rit devant une vue ; sinon quelqu'un face caméra qui sourit"],
  [2, CUT, "un groupe qui marche dans un grand décor (une sortie, une randonnée, une file de clients) ; sinon un plan large avec des gens"],
  [2, CUT, "des amis ou une équipe qui rient, sautent ou se tapent dans la main ; sinon des gens ensemble"],
  [2, CUT, "deux personnes qui rient, en voiture, à vélo ou à table ; sinon un moment complice"],
  [1, CUT, "le coup dur : des travaux, des cartons, la pluie, une porte fermée, un bras en écharpe ; sinon un plan calme et sombre"],
  [2, CUT, "l'attente : une salle vide, un chantier, quelqu'un seul assis ou allongé ; sinon un plan vide de son lieu"],
  [2, CUT, "quelqu'un tête baissée, pensif, dans la pénombre ; sinon un visage de profil, calme"],
  [2, CUT, "un détail de très près dans la pénombre : une main sur un mur, sur un outil, sur une cicatrice ; sinon des mains au calme"],
  [3, CUT, "la reprise : des gens qui repartent, montent, se remettent au travail, dans un grand décor (1,3 s) ; sinon un plan large en mouvement"],
  [2, CUT, "deux personnes assises de dos face à une vue (la mer, la rue, une terrasse) ; sinon un moment calme à deux"],
  [5, CUT, "un long plan qui tourne ou qui suit, impressionnant (2,2 s) : un selfie qui fait le tour, un travelling, une vue d'en haut qui tourne ; sinon son plus beau plan en mouvement"],
  [1.25, CUT, "quelqu'un qui montre un objet à l'objectif (un produit, une tasse, un outil, un appareil) ; sinon des mains qui tiennent quelque chose"],
  [1.5, RISE, "le même objet ou le même geste ailleurs (servi, dehors, en action, sous l'eau) : le décor monte du bas de l'image sur la coupe ; sinon le même objet de plus près"],
  [2.25, CUT, "un plan ample et lent : un animal, quelque chose qui flotte ou glisse, une vague ; sinon un plan au ralenti"],
  [2.25, CUT, "des vagues, de l'eau ou du vent : quelque chose de fort ; sinon un plan large et calme"],
  [1.75, CUT, "quelqu'un de profil, de près, qui regarde au loin (la lumière derrière lui si possible) : il se fond dans le plan suivant ; sinon un visage de profil"],
  [3, DISSOLVE, "une lumière : un coucher de soleil, un ciel doré, une vitrine éclairée, une lampe (elle apparaît à travers le profil, une seconde de fondu) ; sinon son plus beau plan de lumière"],
  [1.25, CUT, "deux personnes debout dans un grand décor qui lancent ou regardent partir quelque chose (un ballon, un drone, un cerf-volant) ; sinon des gens dans un décor"],
  [3.25, WHIP, "un plan rapide qui file au ras des choses (un vélo, une course, une caméra qui fonce) ; sinon un plan qui bouge vite"],
  [2.75, CUT, "un portrait qui lève les yeux, de près, pensif ; sinon un visage de près"],
  [3, CUT, "une main qui écrit, dessine ou prépare de très près (un carnet, une ardoise, une commande) ; sinon des mains au travail"],
  [3.75, CUT, "des gens qui courent ou marchent vers la caméra en riant et la saluent, le soir si possible ; sinon des gens joyeux qui viennent vers la caméra"],
  [2.25, CUT, "une photo de groupe : toute l'équipe, ses clients, une soirée, devant son lieu ; sinon le plus de monde réuni"],
  [2, CUT, "des gens qui se prennent dans les bras, de près ; sinon des gens qui rient ensemble"],
  [4.5, CUT, "le dernier plan, tenu 2 s : des gens dans les bras les uns des autres qui sourient à la caméra ; sinon son plan le plus heureux"],
];
/**
 * Left out first when her files give fewer shots, in this order: shots of its middle that repeat another (never its
 * opening, its counter and the crowd after it, its smoke's shot, its fabric, its plunge, its return to the open air,
 * its blow's first and last, its comeback, its object and its rising water, its dissolve, its whip, its people).
 */
const DROP = [14, 9, 12, 20, 28, 32, 2, 6, 11, 19, 17, 36, 22, 13, 25, 38, 33, 8, 21, 29, 39, 42, 1, 24];
const MOST = ROLES.length;
const FEWEST = MOST - DROP.length;
/** Its counter's shot, its first shot under water, its first back in the open air, its last. */
const COUNTER = 4;
const UNDER = 16;
const SURFACE = 18;
const LAST = MOST - 1;
/** With an ending card (an option), its last shot is held this much longer (1,78 s at its tempo). */
const CARD = 4;
const round = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Its roles for n shots, in order: the original's 44 kept, less the first ones its middle leaves out. */
export function aventureRoles(n: number): number[] {
  const count = Math.max(FEWEST, Math.min(MOST, Math.round(n)));
  const out = new Set(DROP.slice(0, MOST - count));
  return ROLES.map((_, r) => r).filter((r) => !out.has(r));
}

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, reelTexts, end, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const mark = (k, d) => { const v = Number(texts && texts[k]); return Number.isFinite(v) ? v : d; };
  const setting = (k, d) => { const v = texts && texts[k]; return typeof v === "string" && v ? v : d; };
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
  const n = shots.length;
  const cur = Math.max(0, shots.reduce((k, s, i) => (s.from <= frame ? i : k), 0));
  const BEAT = Math.max(4, mark("beat", 13.35));
  const endAt = end ? end.from : durationInFrames + 1;
  // How each of her shots comes in (a cut, or one the original hides), and its cut's frame.
  const kind = (k) => (k > 0 && k < n ? Math.round(mark("t" + k, 0)) : 0);
  const at = (k) => (shots[k] ? shots[k].from : 0);

  // 1. Its frame: her videos full frame, vertical as the original; whole in a 16:9 band on black when most of them are
  // horizontal (or she asks), every place and size below a share of it.
  const format = setting("format", "auto");
  const wideShots = shots.filter((s) => (Number(s.aspect) || 0.5625) > 1.15).length;
  const wide = format === "horizontal" || (format === "auto" && wideShots * 2 > n);
  const bw = width;
  const bh = wide ? Math.round((width * 9) / 16) : height;
  const by = wide ? Math.round((height - bh) / 2) : 0;
  const full = { position: "absolute", left: 0, top: 0, width: bw, height: bh };
  const box = (x, y, w, t) => ({ position: "absolute", left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(t) });
  const film = (k, extra, key) => h(Footage, { key: key || "f" + k, shot: k, style: { ...full, ...(extra || {}) } });

  // 2. The plunge: the shot going into the water brightens over its last three images, the one under water comes in
  // blurred and bright and is sharp six images later (the original's images 395 to 403).
  const plunge = (k) => {
    const C = at(k);
    if (kind(k) === 7 && frame >= C && frame < C + 6) {
      const q = (C + 6 - frame) / 6;
      return { filter: "blur(" + (q * 14).toFixed(1) + "px) brightness(" + (1 + 0.35 * q).toFixed(2) + ") saturate(1.15)" };
    }
    if (kind(k + 1) === 7 && frame >= at(k + 1) - 3) {
      const q = (frame - at(k + 1) + 4) / 3;
      return { filter: "blur(" + (q * 3).toFixed(1) + "px) brightness(" + (1 + 0.3 * q).toFixed(2) + ")" };
    }
    return null;
  };

  // 3. Her shots as filmed, cut on its beats. The cuts it shows otherwise: a whip pan across the cut (8 images, motion
  // blurred), the next shot rising from the bottom like water over its last four images (a soft edge), a dissolve of a
  // second across the cut (each holds its nearest image beyond its own moment, under half).
  const whip = (k) => h(Whip, { key: "w" + k, from: () => film(k - 1, null, "wa"), to: () => film(k, null, "wb"), at: at(k) - 4, frames: 8, direction: "left" });
  const melt = (k) => ({ opacity: interpolate(frame, [at(k) - 15, at(k) + 15], [0, 1], clamp) });
  const layers = (() => {
    const next = cur + 1 < n ? cur + 1 : -1;
    if (next > 0 && kind(next) === 5 && frame >= at(next) - 4) return [whip(next)];
    if (kind(cur) === 5 && frame < at(cur) + 4) return [whip(cur)];
    if (next > 0 && kind(next) === 9 && frame >= at(next) - 15) return [film(cur), film(next, melt(next))];
    if (kind(cur) === 9 && frame < at(cur) + 15) return [film(cur - 1), film(cur, melt(cur))];
    if (next > 0 && kind(next) === 8 && frame >= at(next) - 4) {
      const p = [0.14, 0.3, 0.46, 0.6][Math.max(0, Math.min(3, frame - at(next) + 4))];
      const mask = "linear-gradient(to top, #000 " + Math.round(p * 100 - 3) + "%, transparent " + Math.round(p * 100 + 3) + "%)";
      return [film(cur), film(next, { WebkitMaskImage: mask, maskImage: mask })];
    }
    return [film(cur, plunge(cur))];
  })();

  // 4. The cover over a hidden cut: a copy of a shot, enlarged and very blurred, as something passing right before the
  // lens, leaving towards the top left: [images in before the cut, held after it, out, its light, the shot it is made of
  // (−1 the one that goes, 0 the one that comes)]. Something dark passing (in 1, out 3), the night falling into the dark
  // (in 6, out 6), the colours of the shot that goes filling the lens (its powder: in 6, out 3; its smoke: in 10, out 8),
  // a fabric of the shot that comes right against the lens (out 12).
  const COVERS = { 1: [1, 2, 3, 0.2, 0], 2: [6, 3, 6, 0.14, 0], 3: [6, 1, 3, 1.05, -1], 4: [10, 3, 8, 1.1, -1], 6: [0, 1, 12, 0.8, 0] };
  const cover = (k) => {
    const c = COVERS[kind(k)];
    if (!c || !shots[k] || !shots[k + c[4]]) return null;
    const C = at(k);
    if (frame < C - c[0] || frame >= C + c[1] + c[2]) return null;
    const o = c[0] > 0 ? interpolate(frame, [C - c[0] - 1, C], [0, 1], clamp) : 1;
    const out = interpolate(frame, [C + c[1], C + c[1] + c[2]], [0, 130], clamp);
    const mask = out > 0 ? "linear-gradient(315deg, transparent " + Math.round(out - 30) + "%, #000 " + Math.round(out) + "%)" : "none";
    return h("div", { key: "c" + k, style: { ...full, overflow: "hidden", opacity: o, WebkitMaskImage: mask, maskImage: mask } },
      h("div", { style: { ...box((bw * 3) / 8, (bh * 3) / 8, bw / 4, bh / 4), transform: "scale(6.4)", filter: "blur(6px) brightness(" + c[3] + ") saturate(" + (c[3] > 1 ? 1.3 : 0.85) + ")" } },
        h(Footage, { shot: k + c[4], style: box(0, 0, bw / 4, bh / 4) })));
  };

  // 5. Her counter: what her story counts in one or two words of condensed capitals on two lines, white and translucent
  // (the picture seen through it, about 48 %, no edge, no shadow), centred on her strongest shot from the cut where the
  // music drops (capitals 8 % of the frame's height, the original's); its number one less first, and one beat later
  // hers (« 4 ANS », then « 5 ANS ») swelling a quarter for three images, its other line still; over the next cut it
  // stays, and goes at once three beats after it came. Without a number, her words swell on that beat. In dark ink on
  // a bright place (her shot's light under it, read before the render).
  const hook = reelTexts.find((t) => t.role === "hook");
  const others = reelTexts.filter((t) => t !== hook);
  const TICK = Math.round(mark("tick", hook ? hook.from + BEAT : -1));
  const KC = Math.round(mark("counter_shot", -1));
  const laid = { left: 0, top: by, width: bw, height: bh };
  const CAP = wide ? Math.max(bh * 0.08, height * 0.045) : bh * 0.08;
  const cy = by + bh * 0.527;
  const zone = { x: bw * 0.2, y: cy - CAP * 1.4, w: bw * 0.6, h: CAP * 2.8 };
  // Read on the shot under it now: its strong shot, then the next one it stays over (each written as a number, so only
  // those are read).
  const under = cur === KC + 1 ? KC + 1 : KC;
  const light = under === 2 ? LightUnder(shots[2], frame, laid, zone) : under === 3 ? LightUnder(shots[3], frame, laid, zone) : under === 4 ? LightUnder(shots[4], frame, laid, zone) : under === 5 ? LightUnder(shots[5], frame, laid, zone) : null;
  const INK = light && light.mean >= 0.6 ? "#17130f" : "#ffffff";
  const display = "'" + brand.displayFont + "', 'Bebas Neue', 'Oswald', sans-serif";
  const body = "'" + brand.bodyFont + "', 'Jost', 'Inter Tight', sans-serif";
  const counter = (() => {
    if (!hook || frame < hook.from || frame >= Math.min(hook.to, endAt)) return null;
    const said = String(hook.text || "").replace(/\s+/g, " ").trim();
    const nums = said.match(/\d+/g) || [];
    const last = nums.length ? nums[nums.length - 1] : null;
    const pos = last ? said.lastIndexOf(last) : -1;
    const v = last ? Number(last) : NaN;
    const before = last && v >= 1 ? said.slice(0, pos) + String(v - 1).padStart(last.length > 1 && last[0] === "0" ? last.length : 1, "0") + said.slice(pos + last.length) : said;
    const shown = frame < TICK ? before : said;
    const words = shown.split(" ");
    const lines = words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : [shown];
    const numLine = !last ? -1 : lines.length > 1 && pos > said.lastIndexOf(" ") ? 1 : 0;
    const k = frame - TICK;
    const swell = k >= 1 && k <= 3 ? [1.25, 1.35, 1.12][k - 1] : 1;
    const F = Math.round(CAP / 0.7);
    return lines.map((line, i) => {
      const y = lines.length > 1 ? cy + (i ? 0.585 : -0.585) * CAP : cy;
      const s = numLine < 0 || numLine === i ? swell : 1;
      // Its box holds the font's whole height (about 1,2 of its size), so its capitals keep their 8 % (a tighter box shrank them).
      return h(FitText, { key: "n" + i + line, style: { ...box(bw / 2 - 295, y - CAP * 0.9, 590, CAP * 1.8), opacity: 0.48, ...(s !== 1 ? { transform: "scale(" + s + ")", filter: k <= 2 ? "blur(2px)" : "none" } : {}) }, innerStyle: { fontFamily: display, fontWeight: 400, fontSize: F, lineHeight: 1, letterSpacing: "0.01em", textTransform: "uppercase", whiteSpace: "nowrap", color: INK } }, line);
    });
  })();

  // 6. Its ending card, only when the Reel has one, on its last shot held: the shot a little darker, her words in the
  // counter's capitals, white and whole this time, a line in her text font under them.
  const fade = (a) => interpolate(frame, [a, a + 6], [0, 1], clamp);
  const ending = end && frame >= endAt
    ? [
        h("div", { key: "e0", style: { ...box(0, by, bw, bh), background: "#000000", opacity: 0.35 * fade(endAt) } }),
        h(FitText, { key: "e1" + end.title, style: box(140, cy - CAP * 1.7, width - 280, CAP * 2.3), innerStyle: { fontFamily: display, fontWeight: 400, fontSize: Math.round(CAP / 0.7), lineHeight: 0.95, textTransform: "uppercase", textAlign: "center", textWrap: "balance", color: "#ffffff", opacity: fade(endAt + 1), textShadow: "0 2px 14px rgba(0,0,0,0.35)" } }, end.title),
        end.subtitle ? h(FitText, { key: "e2" + end.subtitle, style: box(140, cy + CAP * 0.75, width - 280, 130), innerStyle: { fontFamily: body, fontWeight: 400, fontSize: 50, lineHeight: 1.2, textAlign: "center", textWrap: "balance", color: "#ffffff", opacity: fade(endAt + 6), textShadow: "0 1px 8px rgba(0,0,0,0.4)" } }, end.subtitle) : null,
      ]
    : null;

  // Any other text of the Reel (none in its slots): a plain white line off its counter, so nothing she wrote is lost.
  const extra = others.filter((t) => frame >= t.from && frame < Math.min(t.to, endAt)).map((t, i) =>
    h(FitText, { key: "x" + i, style: box(140, Math.max(120, cy - CAP * 3 - i * 120), width - 280, 110), innerStyle: { fontFamily: body, fontWeight: 600, fontSize: 52, lineHeight: 1.15, color: "#ffffff", textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.55)" } }, t.text));

  const frameBox = h("div", { style: { position: "absolute", left: 0, top: by, width: bw, height: bh, overflow: "hidden", backgroundColor: "#000000" } },
    ...layers, cover(cur - 1), cover(cur), cover(cur + 1));
  return h(AbsoluteFill, { style: { backgroundColor: "#000000" } }, frameBox, counter, ending, extra);
}`;

export const aventure: MontageSkill = {
  key: "aventure",
  version: 1,
  bpm: BPM,
  shots: [FEWEST, MOST],
  files: [8, 30],
  // Never slower than 130: its longest stays under 45 s, its card included; up to 140 for a shorter Reel.
  tempo: [130, 140],
  // Her camera's own whips and the moments something passes right before her lens (video_read.py): its slots that come
  // in on a whip or under a cover get a real one when she has it, its cut timed on it.
  reads: ["moves", "covered"],
  how: "Ton année comme un film d'aventure, coupée sur les temps d'une folk qui galope : ses plans d'ouverture qui passent derrière du sombre, puis la basse tombe sur son plan le plus fort, de près, et son compteur s'y pose au milieu en capitales blanches translucides (« 4 ANS ») qui prend un cran un temps plus tard (« 5 ANS ») et gonfle ; ses moments à toute allure, chaque coupe cachée derrière ce qui passe devant l'objectif (un fouet, de la poudre, de la fumée, un tissu) ; un plongeon dans l'eau où la musique s'étouffe ; un coup dur en quelques plans plus sombres ; la reprise, un objet montré puis le même ailleurs quand l'eau monte du bas de l'image, un profil qui se fond dans une lumière ; les siens à la fin, la musique sans sa basse. En vertical plein écran ; ses vidéos horizontales entières dans une bande 16:9 sur du noir.",
  end: true,
  texts: [
    {
      slot: "compteur",
      role: "hook",
      want: "ce que compte son histoire, en un ou deux mots courts (le code les met en capitales), avec le nombre qu'elle atteint : son âge (« 5 ans » pour ses 5 ans, « 1 an » pour le premier), une saison (« saison 3 »), une édition (« édition 4 »), l'année qu'elle raconte (« 2026 ») ; le code montre d'abord le nombre d'avant, puis le sien sur le temps fort ; jamais un nombre inventé : sans nombre dans sa demande ni dans ce qu'on sait d'elle, un ou deux mots de ce qu'on raconte (« un an », « l'été », « la saison »)",
      max: 12,
      required: true,
    },
  ],
  settings: [
    {
      name: "format",
      want: "le format : comme ses vidéos, vertical plein écran, ou ses vidéos horizontales entières dans une bande 16:9 sur du noir",
      choices: [
        { value: "auto", says: "comme ses vidéos (vertical, ou dans une bande 16:9 sur du noir quand la plupart sont horizontales)" },
        { value: "vertical", says: "vertical plein écran, ses vidéos horizontales recadrées sur leur sujet" },
        { value: "horizontal", says: "ses vidéos entières dans une bande 16:9 sur du noir" },
      ],
    },
  ],
  timeline(n, options) {
    // At another tempo (a longer Reel, a music's own): every length in beats follows it.
    const bpm = options.bpm ?? BPM;
    const beat = 60 / bpm;
    const roles = aventureRoles(n);
    const spans = beatSpans(
      bpm,
      roles.map((r, i) => ROLES[r]![0] + (options.end && i === roles.length - 1 ? CARD : 0)),
    );
    const duration = spans.at(-1)!.end;
    const start = (role: number) => spans[roles.indexOf(role)]!.start;
    const kc = roles.indexOf(COUNTER);
    // The music's bass drops on the counter's cut, its bar's first beat there; the counter's number takes one more a
    // beat later (14 images at its tempo) and goes three beats after it came (40), over the next shot.
    const drop = start(COUNTER);
    const thin = 1.25 * beat;
    const marks: Record<string, number> = { beat: round3(beat * 30), counter_shot: kc, tick: toFrame(drop + 1.05 * beat) };
    roles.forEach((r, i) => {
      if (i > 0 && ROLES[r]![1] !== CUT) marks[`t${i}`] = ROLES[r]![1];
    });
    return {
      duration,
      shots: spans.map((s, i) => ({ ...s, want: ROLES[roles[i]!]![2] })),
      texts: { compteur: { from: round(drop), to: round(Math.min(drop + 3 * beat, spans[kc + 1]!.end)) } },
      marks,
      // Its first strong beat where the bass drops (the mix sets a bar line there); without its bass from half a beat
      // in until then, rising over the quarter second before; muffled from the plunge to the shot back in the open air;
      // its last shot without its bass, faded over its last 0,3 s (the original's).
      music: {
        downbeat: round3(drop),
        filters: [
          ...(drop > thin + 0.1 ? [{ kind: "thin" as const, from: round3(thin), to: round3(drop), open: round3(Math.min(0.55 * beat, drop - thin)) }] : []),
          { kind: "muffled" as const, from: start(UNDER), to: start(SURFACE) },
          { kind: "thin" as const, from: start(LAST), to: duration },
        ],
        end: { at: duration, fade: 0.3 },
      },
    };
  },
  code: CODE,
  // Its original has neither grain nor dark corners (its fiche, effect 8), and the black around a 16:9 band would carry
  // the grain.
  finish: { grain: 0, vignette: 0 },
};
