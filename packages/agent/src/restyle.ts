// « Ça te ressemble ? » under the first Reel: three buttons that tune the style
// on the manager's own video instead of asking her to describe it. A click keeps
// the adjustment in her art direction (every next montage follows it) and makes
// a corrected version of that Reel at once.

export const RESTYLES = ["warmer", "sober", "punchier"] as const;
export type Restyle = (typeof RESTYLES)[number];

export const RESTYLE: Record<Restyle, { button: string; direction: string; brief: string }> = {
  warmer: {
    button: "Plus chaleureux",
    direction: "Plus chaleureux : tons chauds, lumière douce, textes proches et accueillants, rythme posé.",
    brief:
      "La gérante veut ce Reel plus chaleureux. Garde le même sujet et les mêmes plans, mais réchauffe tout : mêmes messages dits de façon plus proche et accueillante (tutoiement, une touche d'émotion), apparitions douces, rythme un peu plus posé, scènes animées aux tons chauds de sa charte.",
  },
  sober: {
    button: "Plus sobre",
    direction: "Plus sobre : moins de texte et d'effets, typographie fine, beaucoup d'air, fondus lents.",
    brief:
      "La gérante veut ce Reel plus sobre. Garde le même sujet et les mêmes plans, mais épure : moins de texte (les mots les plus forts de ses messages seulement), typographie fine, plus d'espace, fondus lents, animations discrètes et élégantes.",
  },
  punchier: {
    button: "Plus pêchu",
    direction: "Plus pêchu : coupes rapides, textes qui claquent, accroche forte, rythme soutenu.",
    brief:
      "La gérante veut ce Reel plus pêchu. Garde le même sujet, mais donne de l'énergie : accroche plus forte dès la première seconde, coupes plus rapides, ses messages en textes courts qui claquent (capitales, mots en valeur), sans en inventer d'autres, animations plus dynamiques.",
  },
};

/** The buttons under her first Reel: she says it fits, which way to go, or something else in her words. */
export const STYLE_CHECK_OPTIONS = ["Ça me ressemble", ...RESTYLES.map((r) => RESTYLE[r].button), "Autre chose"];

/** Her own wish (« Autre chose »): the same treatment as a button, in her words. */
export function customRestyle(wish: string): { direction: string; brief: string } {
  const words = wish.trim().replace(/\s+/g, " ").slice(0, 200);
  return {
    direction: words.endsWith(".") ? words : `${words}.`,
    brief: `La gérante veut ce Reel autrement : « ${words} ». Garde le même sujet et les mêmes plans, et change ce qu'elle demande, franchement et dans tout le Reel (textes, animations, rythme), sans inventer de messages qu'elle n'a pas donnés.`,
  };
}

const PREFIX = "Ajustement demandé — ";
/** The first wording, still in older art directions. */
const OLD_PREFIX = "Ajustement de la gérante — ";
const isAdjustment = (l: string) => l.startsWith(PREFIX) || l.startsWith(OLD_PREFIX);
/** Adjustments kept in the art direction: the latest ones, one per kind. */
const KEPT = 3;

/**
 * Her art direction with this adjustment added at the end: one line per kind
 * (a new click on the same button replaces it), the latest few kept, within the
 * field's 1500 characters (the oldest adjustments go first, never her own text).
 */
export function withAdjustment(artDirection: string | undefined, restyle: Restyle | { wish: string }, max = 1500): string {
  const line = `${PREFIX}${typeof restyle === "string" ? RESTYLE[restyle].direction : customRestyle(restyle.wish).direction}`;
  const lines = (artDirection ?? "").split("\n").filter((l) => l.trim());
  const own = lines.filter((l) => !isAdjustment(l));
  let adjustments = [...lines.filter((l) => isAdjustment(l) && l !== line), line].slice(-KEPT);
  const join = () => [...own, ...adjustments].join("\n");
  while (join().length > max && adjustments.length > 1) adjustments = adjustments.slice(1);
  return join().slice(0, max);
}
