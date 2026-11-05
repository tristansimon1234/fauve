import { HOUSE_MODELS, houseModel } from "./house-models.ts";

// The signature effects of Edith's models, lent to a Reel made in none of them (Tristan on the creative test of
// 5 November, whose editor was allowed two new animations and made none: « j'ai l'impression qu'il a utilisé l'ancienne
// chaîne du moteur, surtout pas d'ADN et de créativité qui ressort avec les tools qu'on a », then « il faut capitaliser sur
// ce qu'on sait faire au lieu de réinventer, ça coûte beaucoup plus cher de réinventer à chaque fois »). A model's effect
// lives in its skill's code alone (skills/<key>.ts): here is what it is and what it needs in her videos, one line for the
// editor, written from its fiche (docs/fiches/<key>.md, « Effets », « Sur quoi »), its name the catalogue's. The editor
// borrows one or two that fit her videos and names each in its animation's brief (« [borrow: <key>] »); the motion
// designer then starts from that model's code (motion-scene.ts, part « borrow »). Two at most, in one charter, on one
// music: a model holds together because it was thought whole, a patchwork is the risk. Pure data, no skill code (the
// pages import this package): the code lent is chosen server side (lib/agent/borrowed-effects.ts).

/** A model's signature effect: what it does, and what it needs in her videos (in French, from its fiche). */
export type HouseEffect = { effet: string; il_faut: string };

/** Each model's signature effect, by its key, in the catalogue's order (a new model adds its line: tested). */
export const HOUSE_EFFECTS: Record<string, HouseEffect> = {
  decode: {
    effet: "son nom brouillé qui se décode sur le noir comme un générique, puis une bande de vidéo qui grandit derrière lui, coupée toutes les 4 images",
    il_faut: "un nom ou un lieu court, et des vidéos variées de son lieu pour les éclairs de la bande",
  },
  "quatre-coins": {
    effet: "une phrase posée mot à mot sur les bords d'un plan fixe (en haut, au milieu, en bas), la musique qui retient son souffle jusqu'à la coupe",
    il_faut: "un plan fixe et vivant de son lieu, assez large, aux bords calmes (un mur, une étagère, une vitre)",
  },
  mosaique: {
    effet: "ses images coupées en douze tirages posés sur du papier, que l'image suivante remplace case par case, sans jamais s'arrêter",
    il_faut: "une série de photos ou de vidéos serrées de même famille (plats, produits, créations), le sujet au centre",
  },
  "carte-feutre": {
    effet: "un carnet ouvert posé sur ses photos qui défilent en stop motion, son message écrit dessus au feutre, un mot à la fois",
    il_faut: "une quinzaine de photos ou d'images de ses vidéos où ce qui compte est en haut ou en bas, et un message de 6 à 9 mots",
  },
  pile: {
    effet: "ses photos posées en rafale sur une page blanche, du haut vers le bas, puis reprises au même rythme, derrière quatre mots en très grand",
    il_faut: "beaucoup de photos de son travail en série (une vingtaine), et une phrase de 2 à 4 mots courts",
  },
  "mon-travail": {
    effet: "la personne détourée debout dans son lieu, ses mots en très grand devant elle, les photos de son travail posées en rafale derrière",
    il_faut: "une photo ou une vidéo de quelqu'un debout face à l'objectif, téléphone posé, et une quinzaine de photos de son travail",
  },
  "photo-dump": {
    effet: "ses photos et petits passages de vidéo un à un au milieu d'une page claire, chacun à sa forme, un nouveau tous les demi-temps",
    il_faut: "beaucoup de photos et de petits moments de sa semaine (une dizaine au moins)",
  },
  table: {
    effet: "ses photos tirées posées une à une sur sa table filmée, deux mots écrits à la main de part et d'autre de la pile",
    il_faut: "une vidéo de sa table ou de son comptoir filmée posée, le milieu dégagé, et des photos d'une même série de son travail",
  },
  "ecran-partage": {
    effet: "une carte coupée en deux, le geste d'un côté et ce qu'il donne de l'autre au même moment, deux petits titres en serif qui se répondent",
    il_faut: "des vidéos deux par deux, quelqu'un au travail et le résultat de ce geste posé devant la caméra",
  },
  cadre: {
    effet: "son lieu figé en noir et blanc, au milieu un cadre sur ses images en couleur qui grandit d'un cran à chaque coupe jusqu'au plein écran",
    il_faut: "un plan large de son lieu qui fuit vers le centre (un couloir, une porte ou une fenêtre au fond), et des images de ce qui s'y fait",
  },
  fenetres: {
    effet: "le plan suivant qui entre case par case dans des fenêtres, deux petites étiquettes techniques fixes (ses coordonnées, son quartier)",
    il_faut: "des plans larges de son lieu, de sa rue ou de son quartier, et son adresse ou un repère vrai de son commerce",
  },
  facade: {
    effet: "sa devanture qui se construit morceau par morceau sur le noir, un par note, son enseigne d'abord, puis sa façade entière qui s'anime",
    il_faut: "une vidéo fixe de sa devanture filmée de face, son enseigne visible, faite d'éléments séparés (fenêtres, store, tables)",
  },
  gaufre: {
    effet: "son nom pressé en creux dans un papier pêche, qui s'encre lettre à lettre comme un faire-part, une petite ligne dessous",
    il_faut: "son nom ou 1 à 3 mots qui le disent ; rien à filmer, le papier est dessiné",
  },
  "mot-cle": {
    effet: "le mot clé de chaque idée dite face caméra, en très grand au-dessus de sa tête, tenu toute l'idée, les mots autour en petit",
    il_faut: "une vidéo de quelqu'un qui parle face caméra devant un mur uni, avec de la place au-dessus de sa tête",
  },
  frappe: {
    effet: "ce qui fait son lieu qui ressort morceau par morceau (les lettres de son enseigne, ses tasses alignées), puis son nom tapé lettre à lettre dans le ciel",
    il_faut: "son enseigne de près ou des choses alignées, et un plan avec du ciel ou un mur dégagé",
  },
  "titre-derriere": {
    effet: "son nom géant qui monte dans le ciel derrière ses toits, ses arbres ou ses collines (ils passent devant ses lettres), puis le décor qui blanchit morceau par morceau",
    il_faut: "un plan large et fixe de sa rue ou d'un paysage, du ciel en haut et des toits, une enseigne ou des arbres qui y montent",
  },
  journee: {
    effet: "un titre élégant qui apparaît derrière un passage flou au premier plan et tient par-dessus la coupe, puis des flashs photo avec un déclic sur ses plans courts",
    il_faut: "un moment où quelqu'un ou quelque chose passe tout près de l'objectif, et des plans courts de sa journée",
  },
  rallume: {
    effet: "son lieu dans le noir, ses lampes, ses bouteilles ou ses tasses qui se rallument une à une, puis toute la pièce d'un coup et son nom allumé comme une enseigne",
    il_faut: "un plan large de son lieu vu de l'intérieur, le soir de préférence, avec des lumières ou des choses répétées",
  },
  "plans-fixes": {
    effet: "des plans fixes coupés sur les temps, en horizontal sur du noir comme au cinéma, un petit titre en deux niveaux posé mot à mot avec un clic",
    il_faut: "des vidéos filmées téléphone posé où le monde bouge dedans (passants, clients, vapeur, une porte)",
  },
  "coups-de-fouet": {
    effet: "son nom en blanc très condensé posé immobile dans le ciel, puis des plans d'une seconde enchaînés en fouets éclair et flashs blancs",
    il_faut: "un plan large et calme avec du ciel au-dessus des toits, et des vidéos où la caméra balaie vite",
  },
  tourne: {
    effet: "ses plans en largeur tournés d'un quart de tour pour remplir l'écran, en deux tons bleu-vert et crème, la couleur gardée là où elle compte",
    il_faut: "des vidéos filmées en largeur (des lignes, des matières, des gestes) et quelques plans où la couleur compte",
  },
  nike: {
    effet: "noir et blanc très contrasté avec une touche de rouge, un mot rouge condensé par plan sur la coupe, des images en négatif et des ralentis saccadés",
    il_faut: "des vidéos avec du mouvement (un geste, un service, un effort), filmées sans trop trembler",
  },
  eventail: {
    effet: "son premier plan révélé en étoile, une bande par temps sur un fond de couleur, puis entier quand la musique entre",
    il_faut: "un plan avec un centre et des lignes qui en partent (une table vue d'en haut, une allée, un plafond en perspective)",
  },
  coulisses: {
    effet: "ses plans dans une fiche technique quadrillée, le nom de chaque bruitage écrit au moment où on l'entend, la timeline du montage dessous",
    il_faut: "n'importe quelles vidéos de son lieu et de ses gestes, à l'horizontale de préférence",
  },
  interrupteur: {
    effet: "un grand interrupteur dessiné sur son mur, actionné d'un saut ou d'un geste, et son affiche ou son logo qui s'allume d'un coup sur le mur",
    il_faut: "une vidéo fixe de quelqu'un qui saute ou tend le bras vers un point haut d'un mur clair et uni, puis sort du cadre",
  },
  interface: {
    effet: "des mots qui sortent du flou sur fond clair, une liste qui défile, sa phrase tapée, puis son profil et un curseur qui clique « S'abonner »",
    il_faut: "ses mots (trois choses qu'elle fait, sa promesse), son compte et sa photo de profil ou son logo ; rien à filmer",
  },
  pixel: {
    effet: "un titre en pixels qui tremble, posé sur le résultat fini vu d'en haut, et une toute petite légende à chaque étape",
    il_faut: "son résultat fini filmé de dessus, le haut de l'image sombre ou uni, et des gestes filmés téléphone posé",
  },
  "mots-meles": {
    effet: "une grille de lettres sur un plan calme, où des boucles tracées à la main entourent un à un les mots de sa phrase",
    il_faut: "un plan calme et fixe d'une vingtaine de secondes (quelqu'un attablé, des mains au travail), et une phrase de 4 à 6 mots",
  },
  aplat: {
    effet: "une silhouette détourée qui marche sur un grand aplat de couleur vive, puis son vrai plan qui revient autour d'elle morceau par morceau",
    il_faut: "une vidéo de quelqu'un qui marche, de dos ou de profil, en pied, à contre-jour de préférence",
  },
  detourages: {
    effet: "une fenêtre qui s'ouvre sur un plan large et fixe, son nom qui s'y allume lettre par lettre dans le désordre, derrière le décor",
    il_faut: "un plan large et fixe de son lieu ou d'un paysage, avec du ciel ou un mur dégagé et ce qui s'y détache (toits, devanture)",
  },
  createur: {
    effet: "ce dont la personne parle face caméra qui surgit au-dessus d'elle, en moitié d'écran ou plein cadre, au moment où elle le nomme",
    il_faut: "une vidéo de quelqu'un qui parle face caméra avec de la place au-dessus de sa tête, et des photos de ce dont il parle",
  },
  silhouette: {
    effet: "une silhouette de profil d'un seul ton, un mot blanc dans sa tête, puis son nom qui s'écrit derrière elle quand elle baisse la tête",
    il_faut: "une vidéo fixe de quelqu'un de profil devant un fond clair, qui baisse puis relève la tête",
  },
  vision: {
    effet: "son lieu vu par une machine, chaque passant dans un cadre bleu qui clignote, reliés par des fils, puis l'image redessinée en caractères",
    il_faut: "un plan fixe de son lieu fréquenté filmé de haut, quelqu'un d'immobile au milieu et des gens qui passent autour",
  },
  "court-metrage": {
    effet: "ses plans projetés comme une vieille pellicule aux coins arrondis : l'image qui s'ouvre depuis une fente, son titre de film en jaune, une brûlure sur la coupe, la pellicule qui saute",
    il_faut: "des vidéos dans une belle lumière (le matin, l'heure dorée), à l'horizontale de préférence, la première calme",
  },
  "titre-cinema": {
    effet: "le titre de son film en très grandes capitales blanches au milieu de son premier plan, signé dessous en petit serif (« par Léa »), la personne passant devant sa signature, parti avec la coupe où la basse tombe",
    il_faut: "un plan large et fixe où quelqu'un se tient ou marche, du ciel au-dessus de sa tête",
  },
  "celui-la": {
    effet: "ses produits un par temps, sur chacun le même petit mot drôle (« Celui-là ») qui tombe d'un coup chaque fois ailleurs dans l'image, puis une hésitation tapée lettre à lettre et le dernier",
    il_faut: "une photo ou une courte vidéo de chacun de ses produits (cinq au moins) et un plan de toute sa série réunie",
  },
  routine: {
    effet: "la bande-annonce de sa journée en ouverture : un éclair de ses plans toutes les cinq images, sous son titre tapé lettre à lettre avec son curseur, une petite ligne fine dessous",
    il_faut: "des plans variés de sa journée (sa préparation, son lieu, ses gens) et un titre de 2 à 4 mots",
  },
};

/** The most of Edith's models one Reel borrows from: one charter, one music, never a patchwork. */
export const MAX_BORROWED = 2;

/** One model's line for the editor: its key, its name (the catalogue's), its effect and what it needs; none for a key without both. */
export function houseEffectLine(key: string): string | undefined {
  const model = houseModel(key);
  const effect = HOUSE_EFFECTS[key];
  return model && effect ? `${key} — ${model.name} : ${effect.effet}. Il faut : ${effect.il_faut}.` : undefined;
}

/** The lines of the models given (every model by default), in the catalogue's order. */
export function houseEffectLines(keys?: Iterable<string>): string[] {
  const given = keys ? new Set(keys) : null;
  return HOUSE_MODELS.flatMap((m) => {
    const line = !given || given.has(m.key) ? houseEffectLine(m.key) : undefined;
    return line ? [line] : [];
  });
}

/** The editor's rule for a Reel in none of Edith's models (the lab's free=1, a pick that found none). */
const BORROW_FREE = `Edith's models' signature effects, one line each (its key, its name, what the effect does, what it needs in her videos), each coded once in the engine and tested on real footage. This Reel is in none of her models: give it one or two of these effects, never more, picked for what her videos really have (each one's « Il faut ») and for her request; one that carries the Reel beats two that pull apart. A borrowed effect is one of your animations: over her montage, across the shots it needs, where it serves the story; or the whole Reel's composition (« form » « composition ») when the effect is a layout (bands, a split screen, tiles, a frame in the frame). Begin its brief with [borrow: <key>] ([borrow: <key>, <key>] for a composition that takes two), then write it as usual (the message, the words on screen in « », the shots under it, the energy): the motion designer starts from that model's code and sets the effect on her shots and her words, in her charter, on this Reel's one music. Never an effect whose needs her videos lack: none rather than a forced one. Like any new animation it counts in « max_new_scenes » (a composition does not).`;

/** The editor's rule for a Reel she copies that no model plays (a Reel she sent, one of hers kept). */
const BORROW_COPY = `Edith's models' signature effects, one line each (its key, its name, what the effect does, what it needs in her videos), each coded once in the engine and tested on real footage. This Reel copies the Reel she sent (« reel_a_recopier »): when that Reel has one of these effects (the same idea: a title behind the scenery, bands, a decoded title, a split screen, tiles…), remake it from the model's code instead of inventing it again. Write that animation, or the composition, as you would, its brief beginning with [borrow: <key>] ([borrow: <key>, <key>] for a composition that takes two): the motion designer starts from that code and makes the effect look like the Reel she copies, with her shots and her words. One or two at most, never an effect the Reel she copies does not have: none when none matches.`;

/**
 * What the editor gets for a Reel in none of Edith's models (its input's « effets_des_modeles », beside the font pairs:
 * its prompt stays under 17 000 characters): the rule, in English, and the line of each model lent; nothing when none is.
 * `copy`: the Reel copies one she sent, whose own effects alone are remade.
 */
export function houseEffectsForEditor(keys: Iterable<string>, options: { copy: boolean }): { rule: string; effets: string[] } | undefined {
  const effets = houseEffectLines(keys);
  return effets.length ? { rule: options.copy ? BORROW_COPY : BORROW_FREE, effets } : undefined;
}

/** How a brief names the models its animation borrows: « [borrow: titre-derriere] », « [borrow: decode, frappe] ». */
const BORROW_MARK = /\[\s*borrow\s*:\s*([^\]]{1,200})\]/gi;

/** Words as compared: lower case, no accents, no quotes, single spaces. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[«»"“”’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The models one brief borrows among those lent, in the order it names them: by key, or by the model's name. */
export function briefBorrows(brief: string, lent: Iterable<string>): string[] {
  const keys = [...lent];
  const found: string[] = [];
  for (const mark of brief.matchAll(BORROW_MARK)) {
    const said = ` ${plain(mark[1]!)} `;
    const at = keys.flatMap((key) => {
      // A key as a word of its own (« decode », never inside « decoder »), or the model's whole name.
      const word = said.search(new RegExp(`(?<![a-z0-9-])${key.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?![a-z0-9-])`));
      const name = plain(houseModel(key)?.name ?? "");
      const named = name ? said.indexOf(` ${name} `) : -1;
      const first = [word, named].filter((i) => i >= 0);
      return first.length ? [{ key, at: Math.min(...first) }] : [];
    });
    for (const { key } of at.sort((a, b) => a.at - b.at)) if (!found.includes(key)) found.push(key);
  }
  return found;
}

/**
 * For each brief of a Reel's animations, in the Reel's order, the models it borrows among those lent: `most` distinct
 * ones over the whole Reel (the first ones named), a model named again by a later animation still its own.
 */
export function borrowedEffects(briefs: readonly string[], lent: Iterable<string>, most = MAX_BORROWED): string[][] {
  const keys = [...lent];
  const taken: string[] = [];
  return briefs.map((brief) =>
    briefBorrows(brief, keys).filter((key) => {
      if (taken.includes(key)) return true;
      if (taken.length >= most) return false;
      taken.push(key);
      return true;
    }),
  );
}
