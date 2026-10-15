// « Ça te ressemble ? » under the first Reel: three buttons that tune the style
// on the manager's own video instead of asking her to describe it, each a concrete
// change she can picture (faster, fewer words, warmer), never a designer's adjective.
// A click keeps the adjustment in her art direction (every next montage follows it)
// and makes a corrected version of that Reel at once. The keys stay as stored.

/** In the order of the buttons. */
export const RESTYLES = ["punchier", "sober", "warmer"] as const;
export type Restyle = (typeof RESTYLES)[number];

export const RESTYLE: Record<Restyle, { button: string; direction: string; brief: string }> = {
  warmer: {
    button: "Plus chaleureux",
    direction: "Plus chaleureux : tons chauds, lumière douce, textes proches et accueillants, des visages et des sourires, rythme posé.",
    brief:
      "La gérante veut ce Reel plus chaleureux. Garde le même sujet et les mêmes plans, mais réchauffe tout : mêmes messages dits de façon plus proche et accueillante (tutoiement, une touche d'émotion), apparitions douces, rythme un peu plus posé, scènes animées aux tons chauds de sa charte.",
  },
  sober: {
    button: "Moins de texte",
    direction: "Moins de texte : l'accroche et l'invitation seulement, les images parlent, peu d'animations.",
    brief:
      "La gérante veut moins de texte sur ce Reel. Garde le même sujet et les mêmes plans, mais laisse parler les images : seulement l'accroche (4 mots au plus) et l'invitation de la fin, les autres textes et animations retirés, sauf une offre qu'elle a donnée.",
  },
  punchier: {
    button: "Plus rapide",
    direction: "Plus rapide : plans plus courts, accroche dès la première image, coupes sur le temps, un coup de zoom pour appuyer.",
    brief:
      "La gérante veut ce Reel plus rapide. Garde le même sujet, mais accélère : son meilleur plan dès la première image, des plans plus courts qui raccourcissent encore vers le moment fort, un coup de zoom (punch) sur un temps fort, un plan long accéléré (speed 1,5), le Reel plus court au total.",
  },
};

/** The buttons under her first Reel: she says it fits, which way to go, or something else in her words. */
export const STYLE_CHECK_OPTIONS = ["Ça me ressemble", ...RESTYLES.map((r) => RESTYLE[r].button), "Autre chose"];

/** Her own wish (« Autre chose »): the same treatment as a button, in her words. */
export function customRestyle(wish: string): { direction: string; brief: string } {
  const words = wish.trim().replace(/\s+/g, " ").slice(0, 200);
  return {
    direction: words.endsWith(".") ? words : `${words}.`,
    brief: `La gérante veut ce Reel autrement : « ${words} ». Garde le même sujet et les mêmes plans, et change ce qu'elle demande, franchement et dans tout le Reel (textes, animations, rythme).`,
  };
}

const PREFIX = "Ajustement demandé — ";
/** The first wording, still in older art directions. */
const OLD_PREFIX = "Ajustement de la gérante — ";
const isAdjustment = (l: string) => l.startsWith(PREFIX) || l.startsWith(OLD_PREFIX);
/** An adjustment's kind: its words before « : » (« Plus chaleureux »), so a reworded button still replaces its line. */
const kindOf = (l: string) => {
  const body = l.startsWith(PREFIX) ? l.slice(PREFIX.length) : l.startsWith(OLD_PREFIX) ? l.slice(OLD_PREFIX.length) : l;
  const colon = body.indexOf(" : ");
  return (colon > 0 ? body.slice(0, colon) : body).trim().toLowerCase();
};
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
  let adjustments = [...lines.filter((l) => isAdjustment(l) && kindOf(l) !== kindOf(line)), line].slice(-KEPT);
  const join = () => [...own, ...adjustments].join("\n");
  while (join().length > max && adjustments.length > 1) adjustments = adjustments.slice(1);
  return join().slice(0, max);
}
