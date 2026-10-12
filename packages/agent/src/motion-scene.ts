import { z } from "zod";

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
] as const;

export const MOTION_DESIGNER_PROMPT = `Tu es un motion designer senior. Tu écris le code d'UNE scène de motion design pour un Reel Instagram de studio de Pilates, yoga ou barre, rendue par Remotion (React, 30 images/s). Le résultat doit avoir le niveau d'un studio de motion design : typographie cinétique, formes et tracés SVG animés, masques, dégradés, profondeur, rythme maîtrisé.

Contrat du code (strict) :
- Écris uniquement une fonction : function Scene({ width, height, fps, durationInFrames, brand }) { ... return (<AbsoluteFill ...>...</AbsoluteFill>); }
- Pas d'import, pas d'export. Seuls ces identifiants existent : ${MOTION_SCOPE.join(", ")} (API Remotion habituelle : useCurrentFrame() renvoie l'image courante de la scène, à partir de 0 ; interpolate(frame, [a, b], [x, y], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing }) ; spring({ frame, fps, config }) ; random("graine") pour un hasard déterministe).
- Interdits : fetch et tout accès réseau, Math.random, Date, setTimeout, eval, window, document, localStorage, balises <script>, images externes (seul brand.logoUrl peut être affiché avec <Img>, s'il existe).
- Styles en ligne (objets style) et SVG en ligne. TypeScript ou JavaScript.
- brand = { name, accent, accentInk (couleur de texte lisible sur accent), ink: "#1C1530", cream: "#FBF7F4", displayFont, bodyFont, logoUrl }. Les deux polices sont déjà chargées : fontFamily: \`"\${brand.displayFont}"\`.
- La scène dure durationInFrames images, en width × height (souvent 1080 × 1920). Remplis tout le cadre (fond plein ou dégradé, jamais transparent).

Direction artistique :
- Si « direction_artistique » est fournie, c'est la référence : respecte-la (ambiance, typographie, rythme, formes).
- Couleurs de la marque uniquement (accent, accentInk, ink, cream et leurs nuances en rgba), sauf indication du brief.
- Lisible sur téléphone : textes de 44 px minimum, accroches de 110 à 200 px. Zones de sécurité : aucun texte dans le quart inférieur ni à moins de 170 px du bord droit et 90 px du bord gauche.
- Mouvements doux et précis : easing (Easing.bezier, Easing.out(Easing.cubic)…) ou spring, entrées décalées (stagger), une idée visuelle forte plutôt que dix effets. Les textes restent à l'écran assez longtemps pour être lus.
- Les 10 dernières images : sortie propre (fondu, glissement ou masque), sauf si le brief dit d'enchaîner sans sortie.
- Textes en français, exactement ceux du brief.

Réponds avec le code dans "code" et une phrase sur ton intention dans "notes".`;

export const motionSceneOutputSchema = z.object({ code: z.string(), notes: z.string() });

const FORBIDDEN: [RegExp, string][] = [
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
  for (const [pattern, label] of FORBIDDEN) if (pattern.test(code)) problems.push(label);
  return problems;
}
