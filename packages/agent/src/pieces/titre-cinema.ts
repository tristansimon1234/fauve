import { REEL_FPS } from "../motion.ts";
import type { EffectPiece, PieceTimeline, PieceTimelineInput } from "../pieces.ts";

// « Générique signé », the effect (docs/fiches/titre-cinema.md, effects 1 to 3; its whole Reel is skills/titre-cinema.ts,
// whose opening it is): over one wide still shot of hers, a film's opening title, signed: her word in very heavy
// capitals, white, dead centre across 62,5 % of the frame for 14 letters (a shorter word bigger, its capitals 6 % of the
// width at most), and under its end, a gap of 59 % of a capital lower, her signature in a roman serif (« par Léa », its
// capitals 72 % of the title's, 48 px at least); there from its first image, still, gone with the cut of that shot.
// Set from where she is (her cut-out, read every six images over the shot): her head covers the lower half of her
// signature's capitals, she in front of it (never of the title), the signature under the part of the title above her;
// no room above her, in front of her, low in the frame; nobody, at the original's place (its title's capitals centred
// on the middle of the frame, the signature under its end). Under it the music plays without its bass, which comes in
// on that cut, as the original's beat drops on its first cut. Kept in her charter: her display font in its heaviest
// weight for the title, her text font for the signature, the original's warm white. Left out: the model's other shots,
// its 10:9 window (the montage plays full frame under it), its ending card, and the original's own words
// (« CINEMATOGRAPHY », « by TASHI »), which give way to hers.

/** Its stage: the first of her shots under it that plays 9 images of it at least (never the last image of the shot before), its rank among them, its span (frames from its start). */
export function genericStage(shots: { from: number; frames: number }[], frames: number): { rank: number; from: number; to: number } {
  const plays = (s: { from: number; frames: number }) => Math.min(frames, s.from + s.frames) - Math.max(0, s.from);
  const found = shots.findIndex((s) => plays(s) >= Math.min(9, frames / 2));
  const rank = found < 0 ? 0 : found;
  const s = shots[rank] ?? { from: 0, frames };
  return { rank, from: Math.max(0, Math.round(s.from)), to: Math.max(1, Math.min(frames, Math.round(s.from + s.frames))) };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const CODE = String.raw`function Scene({ width, height, durationInFrames, brand, shots, texts }) {
  const h = React.createElement;
  const frame = useCurrentFrame();
  const word = (k) => { const v = texts && texts[k]; return typeof v === "string" ? v.trim() : ""; };
  const mark = (k, d) => { const v = texts && texts[k]; const n = typeof v === "string" && v.trim() ? Number(v) : NaN; return Number.isFinite(n) ? n : d; };
  const within = (v, a, b) => Math.max(a, Math.min(b, v));
  // A phone number or a date never breaks between its digits.
  const keep = (s) => String(s || "").replace(/(\d) (?=\d)/g, "$1 ");
  // Its shots: those that play during it. Its stage is the first that plays 9 images of it at least: its title goes with
  // that shot's cut (a shot after it under the effect plays bare, its bass back).
  const mine = shots.map((s, i) => i).filter((i) => shots[i].from < durationInFrames && shots[i].from + shots[i].durationInFrames > 0);
  const title = word("titre");
  if (!mine.length || !title) return null;
  const plays = (i) => Math.min(durationInFrames, shots[i].from + shots[i].durationInFrames) - Math.max(0, shots[i].from);
  const g = mine.find((i) => plays(i) >= Math.min(9, durationInFrames / 2)) ?? mine[0];
  const START = Math.max(0, Math.round(shots[g].from));
  const END = Math.round(mark("cut", Math.min(durationInFrames, shots[g].from + shots[g].durationInFrames)));
  if (frame < START || frame >= END) return h(AbsoluteFill, { style: { pointerEvents: "none" } });
  const laid = { left: 0, top: 0, width, height };
  const box = { position: "absolute", left: 0, top: 0, width, height };

  // 1. Its lockup's sizes, measured on the original: a font whose capitals are 0,63 of it (the title) and 0,66 (the serif).
  const word0 = keep(title).toUpperCase();
  const F = Math.round(within((width * 0.625) / (0.716 * Math.max(4, Array.from(word0).length)), width * 0.05, width * 0.095));
  const S = Math.round(within(F * 0.69, 48, 64));
  const m = Math.round(0.22 * F - 0.25 * S);
  const HK = Math.round(1.22 * F + 0.9 * S);
  const pad = Math.round(0.25 * F);
  const top0 = 96;
  const top1 = Math.round(height * 0.75 - 12 - HK);
  const middle = within(Math.round(height * 0.5 - 0.535 * F), top0, top1);

  // 2. Where she is on her stage, read on her cut-out every six images: the middle of the heights its top reaches (her
  // head) and the middle of where she stands across it (no hook: it plays only during its stage).
  const her = (() => {
    const seen = [];
    for (let f = START; f < END; f += 6) {
      const b = SubjectBox(shots[g], f, laid);
      if (b && b.w > 4 && b.h > 4) seen.push(b);
    }
    if (!seen.length) return null;
    const mid = (list) => list.sort((a, b) => a - b)[Math.floor(list.length / 2)];
    return { top: mid(seen.map((b) => b.y)), x: mid(seen.map((b) => b.x + b.w / 2)) };
  })();

  // 3. Its place: her head covering the lower half of her signature's capitals (behind her); no room above her, in front
  // of her, low; nobody, the original's place.
  const below = her ? Math.round(her.top - 1.22 * F - 0.33 * S) : null;
  const behind = below !== null && below >= top0;
  const T = behind ? Math.min(below, top1) : her ? top1 : middle;
  const side = !her ? "right" : her.x > width * 0.58 ? "right" : her.x < width * 0.42 ? "left" : "center";
  const display = "'" + brand.displayFont + "', 'Archivo Black', sans-serif";
  const serif = "'" + brand.bodyFont + "', 'Times New Roman', serif";
  const WHITE = "#fffcf8";
  const sign = word("signature");
  // One box for both, its top on the title's line, a pad around it (the glyphs of a tight line poke out of it).
  const lockup = h(FitText, { key: "title-" + word0 + "|" + sign, style: { position: "absolute", left: 140, top: T - pad, width: width - 280, height: HK + 2 * pad }, innerStyle: { justifyContent: "flex-start", paddingTop: pad } },
    h("div", { style: { display: "flex", flexDirection: "column", alignItems: "stretch" } },
      h("div", { style: { fontFamily: display, fontWeight: 900, fontSynthesis: "none", fontSize: F, lineHeight: 1, letterSpacing: "-0.01em", color: WHITE, whiteSpace: "nowrap", textAlign: "center" } }, word0),
      sign ? h("div", { style: { fontFamily: serif, fontWeight: 400, fontSize: S, lineHeight: 1.15, marginTop: m, padding: "0 " + Math.round(0.13 * F) + "px", color: WHITE, whiteSpace: "nowrap", textAlign: side } }, keep(sign)) : null));
  // She passes in front of her signature: her cut-out laid over it, on her stage only.
  const over = behind ? h(Subject, { key: "her", shot: g, style: box }) : null;
  return h(AbsoluteFill, null, lockup, over);
}`;

export const titreCinema: EffectPiece = {
  key: "titre-cinema",
  version: 1,
  name: "Générique signé",
  how: "sur son plan large et fixe, le titre de son film en très grandes capitales blanches au milieu de l'image, là dès la première image et immobile, signé dessous en petit serif (« par Léa »), la personne qui passe devant sa signature, jamais devant le titre ; la musique sans basse sous lui, et la basse qui tombe sur la coupe qui l'emporte.",
  needs: "un plan large et fixe (le téléphone posé) où quelqu'un se tient ou marche lentement, petit dans l'image, du ciel ou un fond calme au-dessus de sa tête.",
  lays: "sur ce plan large et fixe, en ouverture de préférence, 3 à 7 s (l'original : 6 s, toute l'intro de sa musique) ; le titre part avec sa coupe et la basse tombe dessus, un plan après lui sous l'effet joue nu",
  shots: [1, 2],
  seconds: [2.5, 8],
  require: { files: 1, shot: { framing: ["wide"], still: true, person: true } },
  texts: [
    {
      slot: "titre",
      want: "le titre de son film, en très grandes capitales au milieu de son plan : son métier ou son art en un mot (« Pâtisserie », « Céramique »), le nom de son lieu, ou ce que montre le Reel (« Escapade ») ; un seul mot de préférence, plus il est court plus il est grand",
      max: 16,
      required: true,
    },
    {
      slot: "signature",
      want: "sa signature sous la fin du titre, comme celle d'un réalisateur : « par » et son prénom quand on le connaît (« par Léa »), sinon le nom de son commerce ; rien d'inventé",
      max: 26,
      required: true,
    },
  ],
  timeline({ frames, shots }: PieceTimelineInput): PieceTimeline {
    // Its stage, cut out (she passes in front of her signature), and its music without its bass until its cut.
    const stage = genericStage(shots, frames);
    return {
      marks: { cut: stage.to },
      cutouts: [stage.rank],
      music: { filters: [{ kind: "thin", from: round3(stage.from / REEL_FPS), to: round3(stage.to / REEL_FPS) }] },
    };
  },
  code: CODE,
};
