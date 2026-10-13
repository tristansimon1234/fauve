import { z } from "zod";
import { SLOT_NAME } from "./schemas.ts";

// Free motion-design scenes. The motion designer (a dedicated Opus call) writes
// a React component for one scene; it runs inside the Remotion render with a
// fixed scope and no imports. The code is checked statically here, then
// smoke-rendered in the render sandbox before it reaches a video.

/** Identifiers the generated code can use; nothing else is in scope. */
export const MOTION_SCOPE = [
  "React",
  "AbsoluteFill",
  "Sequence",
  "Img",
  "useCurrentFrame",
  "useVideoConfig",
  "interpolate",
  "interpolateColors",
  "spring",
  "Easing",
  "random",
  "FitText",
] as const;

export const MOTION_DESIGNER_PROMPT = `Tu es un motion designer senior. Tu écris le code d'UNE scène de motion design pour un Reel Instagram d'un commerce de quartier (studio de sport, salon, restaurant, boutique…), rendue par Remotion (React, 30 images/s). Le résultat doit avoir le niveau d'un studio de motion design : typographie cinétique, formes et tracés SVG animés, masques, dégradés, profondeur, rythme maîtrisé.

Contrat du code (strict) :
- Écris uniquement une fonction : function Scene({ width, height, fps, durationInFrames, brand, texts }) { ... return (<AbsoluteFill ...>...</AbsoluteFill>); }
- La scène sera réutilisée dans d'autres Reels avec d'autres textes : aucun texte en dur. Chaque texte vient d'un « slot » : texts.nom_du_slot (minuscules, chiffres, _), avec le texte du brief en valeur par défaut (texts.title ?? "…"). texts est toujours un objet, peut-être vide. Déclare chaque slot dans "slots" avec sa longueur maximale, et mets chaque slot dans un FitText pour que tout tienne, quelle que soit la longueur réelle du texte.
- Pas d'import, pas d'export. Seuls ces identifiants existent : ${MOTION_SCOPE.join(", ")} (API Remotion habituelle : useCurrentFrame() renvoie l'image courante de la scène, à partir de 0 ; interpolate(frame, [a, b], [x, y], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing }) ; spring({ frame, fps, config }) ; random("graine") pour un hasard déterministe).
- FitText garantit qu'un texte tient dans sa boîte : <FitText style={{ position: "absolute", left: 140, top: 520, width: 800, height: 420 }} innerStyle={{ fontFamily: \`"\${brand.displayFont}"\`, fontSize: 180, lineHeight: 1, color: brand.ink }}>{title}</FitText>. style place la boîte (dans la zone de sécurité) ; innerStyle donne la typographie et la mise en page du contenu (centré par défaut, en colonne flex). Si le texte est trop long pour la taille demandée, tout le contenu rétrécit jusqu'à tenir, sans couper de mot. Mets chaque texte dans un FitText (anime la boîte ou ses enfants librement) ; jamais de whiteSpace: "nowrap" sur un texte sans FitText.
- Interdits : fetch et tout accès réseau, Math.random, Date, setTimeout, eval, window, document, localStorage, balises <script>, images externes (seul brand.logoUrl peut être affiché avec <Img>, s'il existe).
- Styles en ligne (objets style) et SVG en ligne. TypeScript ou JavaScript.
- brand = { name, accent, accentInk (couleur de texte lisible sur accent), ink: "#1C1530", cream: "#FBF7F4", displayFont, bodyFont, logoUrl }. Les deux polices sont déjà chargées : fontFamily: \`"\${brand.displayFont}"\`.
- La scène dure durationInFrames images, en width × height (souvent 1080 × 1920). Remplis tout le cadre (fond plein ou dégradé, jamais transparent).

Direction artistique :
- Si « direction_artistique » est fournie, c'est la référence : respecte-la (ambiance, typographie, rythme, formes).
- Couleurs de la marque uniquement (accent, accentInk, ink, cream et leurs nuances en rgba), sauf indication du brief.
- Lisible sur téléphone : textes de 44 px minimum, accroches de 110 à 200 px. Un texte centré l'est sur toute la largeur (axe x = 540).
- Zone de sécurité, à chaque image (rebonds, zooms et rotations compris) : chaque texte reste entier entre x = 140 et x = width − 140, et entre y = 80 et y = 0,75 × height (rien dans le quart inférieur). Un texte ne déborde jamais du cadre et n'est jamais coupé par un bord, même si le brief le demande : seuls les formes et les décors peuvent sortir du cadre. Un texte peut entrer depuis l'extérieur, mais il est entièrement dans la zone moins de 0,3 s après son apparition ; un zoom ou un rebond n'agrandit pas un texte au-delà de sa boîte. C'est vérifié automatiquement à toutes les images : une scène dont un texte sort de la zone est refusée.
- Polices : uniquement brand.displayFont et brand.bodyFont. Aucune autre police n'est chargée : elle serait remplacée par une police de secours, souvent plus large.
- Mouvements doux et précis : easing (Easing.bezier, Easing.out(Easing.cubic)…) ou spring, entrées décalées (stagger), une idée visuelle forte plutôt que dix effets. Les textes restent à l'écran assez longtemps pour être lus.
- Les 10 dernières images : sortie propre (fondu, glissement ou masque), sauf si le brief dit d'enchaîner sans sortie.
- Textes en français, exactement ceux du brief.

Réponds avec le code dans "code", une phrase sur ton intention dans "notes", un nom court et parlant dans "name" (ex. « Titre serif qui se dessine ») et la liste des slots dans "slots".`;

export const motionSlotSchema = z.object({
  name: z.string().regex(SLOT_NAME),
  role: z.string().max(120).describe("Ce que contient ce texte, ex. « accroche principale »"),
  max_chars: z.number().int().min(1).max(200),
});
export type MotionSlot = z.infer<typeof motionSlotSchema>;

export const motionSceneOutputSchema = z.object({
  code: z.string(),
  notes: z.string(),
  name: z.string().max(80),
  slots: z.array(motionSlotSchema).max(8),
});

/** Patterns generated code may not contain (shared with the text layers). */
export const FORBIDDEN_CODE: [RegExp, string][] = [
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|\bWorker\b/, "accès réseau"],
  [/^\s*(import|export)\s/m, "import/export"],
  [/\b(require|import)\s*\(/, "chargement de module"],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, "eval"],
  [/\bMath\.random\b|\bDate\b|performance\.now|setTimeout|setInterval|requestAnimationFrame/, "non déterministe"],
  [/\b(window|document|globalThis|localStorage|sessionStorage|indexedDB|navigator|location|parent|top|self)\s*[.[]/, "accès au navigateur"],
  [/<\s*(script|iframe|object|embed|link|meta)\b/i, "balise interdite"],
  [/\b(src|href)\s*=\s*\{?\s*["'`](https?:|\/\/|data:)/i, "ressource externe"],
];

/** Problems that forbid running the code (empty when it is acceptable). */
export function checkMotionCode(code: string): string[] {
  const problems: string[] = [];
  if (code.length > 24000) problems.push("code trop long");
  if (!/\bfunction\s+Scene\s*\(/.test(code)) problems.push("il faut une fonction Scene");
  for (const [pattern, label] of FORBIDDEN_CODE) if (pattern.test(code)) problems.push(label);
  return problems;
}
