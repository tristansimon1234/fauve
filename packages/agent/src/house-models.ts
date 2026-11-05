import { fontPair, pairFonts, type FontPair } from "./font-pairs.ts";
import { HOUSE_MEASURES } from "./house-measures.ts";
import { houseSheets } from "./house-sheets.ts";
import { reelLookSchema, type ReelLook } from "./looks.ts";
import { filmWords, STEAL_READER, stolenStyleLines, type StolenLook, type StolenStyle } from "./steal.ts";
import type { z } from "zod";

// Edith's own models (lot 5; Tristan: « chaque référence deviendra un modèle soigné qu'Edith sait refaire quand on
// lui demande « fais-en un comme ça » »): the reference Reels of the bank, watched frame by frame, each written down
// as a Reel she copies is read (its form, its hook, its type, its moments at their times, its light, its music, its
// ending), with what the sandbox measured on it (its cuts and its tempo, house-measures.ts), the finish it wears (its
// look: grade, grain, vignette), the font pairing it is set in (font-pairs.ts) and, for most, a reference composition
// written with the kit and timed on it (house-examples.ts, shown to the motion designer as a worked example).
// A model is never one shot: she picks it in Créer › « Un modèle d'Edith » (or Edith takes it in the chat), and the
// Reel follows it as it follows a Reel she sends (posts.inspiration_id on a row of hers, source « house »), never
// its images, its words nor its music. Readings written by hand, in French like the reader's.

/** The source of the inspiration row a house model is kept on, per studio (one per model, made when first used). */
export const HOUSE_SOURCE = "house";
/** The catalogue's version: a studio's row written by an older one is rewritten when the model is used again (3: its original's sheets; 4: no brand in a model's name; 5: Mots aux quatre coins as its original; 6: Plans fixes at 65 BPM; 7: four renamed; 8: Lieu tapé without its original's orange; 9: Plans fixes on its fiche; 10: Une journée chez toi on its fiche; 11: ten models on their fiches; 12: Façade qui se construit and Coulisses façon fiche on their fiches; 13: Recette cosy on its fiche). */
export const HOUSE_VERSION = 13;

export type HouseModel = {
  key: string;
  /** Its name for her. */
  name: string;
  /** What it does, in one sentence for her. */
  pitch: string;
  /** What to give it, in a few words. */
  needs: string;
  /** How many of her files it wants (photos or videos). */
  files: [number, number];
  /** Its font pairing (font-pairs.ts). */
  pair: string;
  /** Its reference composition (house-examples.ts), when it has one. */
  example: string | null;
  /**
   * Its tempo (its music is composed at it): as its fiche counts it on its original's music, or the grid of its cuts when
   * that music has no steady beat; house-measures.ts's bpm, when it has one, wins (the same, for a model on its fiche).
   */
  tempo?: number;
  /** Its finish, as a look's settings (looks.ts), made into a look when used. */
  finish: Omit<Partial<z.input<typeof reelLookSchema>>, "name"> & { name: string };
  /** The reading, as the reader writes it for a Reel she sends. */
  look: StolenLook;
};

const TEXT_DEFAULTS: StolenLook["text"] = {
  amount: "une ligne",
  composition: "",
  case: "normal",
  weight: "bold",
  tracking: "normal",
  align: "center",
  stress: "none",
  band: "none",
  subtitles: false,
  stroke: "regular",
  lines: "aligned",
  tilt: 0,
  shadow: "none",
};

type Reading = Omit<StolenLook, "text" | "voice" | "effect" | "camera" | "transitions" | "grade" | "motion"> &
  Partial<Pick<StolenLook, "voice" | "effect" | "camera" | "transitions" | "grade" | "motion">> & { text: Partial<StolenLook["text"]> & Pick<StolenLook["text"], "composition"> };

/** A reading with the reader's defaults (nobody speaks, a plain cut, natural light). */
function read(pair: string, r: Reading): StolenLook {
  const display = fontPair(pair)?.display.family;
  return {
    voice: "aucune",
    effect: "none",
    camera: "stabilisée",
    transitions: "coupes nettes",
    grade: "natural",
    motion: "epure",
    ...r,
    text: { ...TEXT_DEFAULTS, ...(display ? { font: display } : {}), ...r.text },
  };
}

type Spec = Omit<HouseModel, "look"> & { look: Reading };
const model = (s: Spec): HouseModel => ({ ...s, look: read(s.pair, s.look) });

export const HOUSE_MODELS: HouseModel[] = [
  model({
    key: "decode",
    name: "Titre qui se décode",
    // 11: written again on its original's fiche (v3 of its skill): horizontal 16:9 on black when her videos are, six bands
    // landing then folding in three steps, its title decoding on the black, the band that grows behind it with a cut
    // every 4 images, a calm shot in silence, its ending by layers; an electro-pop beat at 122, cream highlights over
    // green-blue shadows (not the « cine » preset's orange), no grain nor dark corners; its small words in its title's face.
    pitch: "Six de tes plans en bandes, puis ton nom qui se décode sur le noir comme un générique, un montage éclair dans une bande qui grandit derrière lui, et une fin où ton lieu change derrière une personne.",
    needs: "3 à 12 vidéos ou photos de ton lieu, en largeur de préférence : des sujets debout au centre, plein de petits moments, un plan calme, quelqu'un qu'on suit, toi ou quelqu'un de l'équipe en entier, caméra posée, et des photos de tes lieux",
    files: [3, 12],
    pair: "decodage",
    example: "E-decode",
    // Measured on its original (docs/fiches/decode.md): its sixteenth notes steady within 28 ms.
    tempo: 122,
    // Its skill's own finish sets the same contrast, saturation and lifted blacks.
    finish: { name: "Vert et crème", hint: "ombres vert-bleu, hautes lumières crème, couleurs douces, noirs un peu levés, sans grain ni coins sombres", contrast: 0.06, saturation: -0.1, fade: 0.05, shadows: "#16261E", highlights: "#EDE9E0", split: 0.3 },
    look: {
      name: "titre qui se décode",
      format: "message",
      hook: { kind: "mystère", what: "six bandes verticales de vidéo qui entrent une à une, puis se replient en un trait : on attend un titre" },
      text: {
        amount: "une ligne",
        composition: "un titre en capitales régulières blanches sur une ligne, sans ombre, et au-dessus trois petits mots en minuscules un peu espacées sur ses bords (le premier à gauche, le dernier à droite), centrés sur le noir",
        case: "upper",
        weight: "regular",
        tracking: "normal",
      },
      layout: "six bandes verticales côte à côte, puis une bande de vidéo qui s'ouvre derrière le titre et grandit, en 16:9 sur du noir comme l'original quand ses vidéos sont horizontales",
      moments: [
        { at: 0.13, what: "six bandes verticales de vidéo entrent d'un coup une à une, de gauche à droite, toutes les 0,2 s, chacune avec un déclic" },
        { at: 2.27, what: "la rangée se replie vers un trait au milieu en trois marches, une par temps, un souffle chacune ; puis le noir" },
        { at: 3.97, what: "après un impact, trois petits mots et le titre brouillé d'un coup sur le noir ; il se brouille puis se pose en 1,3 s sur des tics" },
        { at: 5.73, what: "la musique entre, étouffée : une bande de vidéo s'ouvre derrière le titre et grandit à vitesse constante jusqu'au plein cadre ; dedans, une coupe toutes les 4 images" },
        { at: 13.27, what: "le titre part d'un coup, la musique s'arrête : un plan calme tenu 1,4 s presque en silence" },
        { at: 14.7, what: "la musique pleine sur un plan qui suit quelqu'un ; le lieu change derrière lui, puis il reste un temps, détouré, sur le plan suivant" },
        { at: 18.73, what: "la chose du plan suivant arrive détourée en avance, à sa place, avant le reste de son image" },
        { at: 20.7, what: "une personne détourée surgit au premier plan et reste pendant que le lieu change deux fois derrière elle" },
      ],
      grade: "cool",
      motion: "epure",
      music: "upbeat electro-pop travel beat, kick and clap on every beat, 16th-note pulse",
      ending: "une personne détourée qui reste pendant que ses lieux changent derrière elle, puis la dernière image noire ; la musique pleine jusqu'au bout",
      why: "Le titre se fait attendre puis se résout comme un générique : on reste pour le lire, la bande qui grandit et son montage éclair donnent de l'ampleur au lieu, et la fin par couches surprend.",
    },
  }),
  model({
    key: "quatre-coins",
    name: "Mots aux quatre coins",
    // 11: written again on its original's fiche (v2 of its skill): horizontal 16:9 on black when her videos are, its words
    // in cream at one size without a shadow, a fixed camera, its music losing its bass on the whole sentence and back on
    // the first cut, its front held 7,5 s; its tempo (92), no vignette; no reference composition (« O-bords » cut its words
    // by the edges at a very large size, which the original never does).
    pitch: "Une phrase posée mot à mot sur les bords du premier plan de ton lieu, la musique qui retient son souffle, puis la vie du lieu en plans courts et ton nom seul sur ta devanture.",
    needs: "4 à 12 vidéos, téléphone posé : un plan fixe et vivant de ton lieu, des plans courts de l'équipe, des clients et des détails, et ta devanture de face où quelqu'un entre",
    files: [4, 12],
    pair: "grotesque",
    example: null,
    // Measured on its original (docs/fiches/quatre-coins.md): its kick on this grid, a word every three quarters of a beat.
    tempo: 92,
    finish: { name: "Chaud naturel", hint: "lumière chaude, hautes lumières crème, grain à peine, sans coins sombres", contrast: 0.1, saturation: 0.05, warmth: 0.18, grain: 0.2, grain_size: "fine" },
    look: {
      name: "mots aux quatre coins",
      format: "pov",
      hook: { kind: "pov", what: "le premier plan de son lieu, fixe, et une phrase qui se pose mot à mot sur les bords du cadre" },
      text: {
        amount: "un message tenu",
        composition: "une phrase le long des bords : ses premiers mots en haut (à gauche, au tiers, à droite), son nom et son quartier au milieu (à gauche, à droite), l'adresse en bas sur une ligne ; minuscules crème, même taille, jamais coupés",
        case: "normal",
        weight: "bold",
        tracking: "tight",
        align: "left",
        shadow: "none",
      },
      layout: "des mots posés le long des bords du cadre sur le premier plan, en 16:9 sur du noir comme l'original quand ses vidéos sont horizontales",
      moments: [
        { at: 0, what: "le premier plan de son lieu, fixe, quelqu'un au travail un peu à gauche du centre, sans un mot les deux tiers d'une seconde" },
        { at: 0.67, what: "un mot posé d'un coup tous les trois quarts de temps sur les bords : trois en haut (à gauche, au tiers, à droite), son nom et son quartier au milieu, son adresse en bas" },
        { at: 3.15, what: "la phrase entière tenue ; la musique perd sa basse et sa grosse caisse" },
        { at: 5.5, what: "première coupe, sur la reprise de la musique : tous les mots partent d'un coup ; puis dix plans de la vie du lieu, plein cadre, sans texte, larges et serrés en alternance, un temps et quart chacun" },
        { at: 14.33, what: "sa devanture de face, fixe, tenue jusqu'à la fin ; son nom seul au milieu à 15,9 s, quand quelqu'un passe la porte" },
      ],
      camera: "fixe",
      grade: "warm",
      music: "downtempo soul, laid-back kick on every beat, heavy round bass, mellow guitar",
      ending: "sa devanture de face, tenue sept secondes et demie, son nom seul au milieu ; la musique s'arrête avec la dernière image",
      why: "Le lieu se lit comme une couverture de magazine : la phrase qui longe les bords donne de l'échelle sans cacher les gens, la musique qui retient son souffle fait attendre la coupe, et son nom revient seul sur sa porte.",
    },
  }),
  model({
    key: "mosaique",
    name: "Mosaïque qui change",
    // 11: written again on its original's fiche (v3 of its skill): prints laid by hand on a light grey paper, taken in
    // reading order, a picture every 1,2 s never held, each print landing askew then straight, the loop; its tempo (130,
    // its music's: 100 was its tiles' pace), a matte warm print without the grain nor the corners its original lacks.
    pitch: "Tes images coupées en douze tirages posés sur du papier, que la suivante remplace case par case, sans arrêt, jusqu'à revenir à la première.",
    needs: "5 à 10 photos ou vidéos serrées de tes plats, produits ou réalisations, le sujet au centre, la plus belle en premier",
    files: [4, 10],
    pair: "editorial",
    example: "B-continu",
    // Measured on its original (docs/fiches/mosaique.md): a neo-soul beat, a hit within 9 ms of each beat; its tiles go
    // at their own pace, a print every 3 images.
    tempo: 130,
    finish: { name: "Tirage mat", hint: "noirs relevés et bruns, lumière chaude, sans grain ni coins sombres", contrast: -0.04, warmth: 0.15, fade: 0.45 },
    look: {
      name: "mosaïque en continu",
      format: "autre",
      hook: { kind: "geste", what: "la première image déjà coupée en douze tirages sur du papier gris clair, et une case qui change aussitôt" },
      text: { amount: "aucun", composition: "aucun texte : les images seules" },
      layout: "ses images coupées en 3 × 4 tirages posés à la main sur un papier gris clair, une fine marge et un trait clair ; ses images horizontales entières dans un bloc 16:9 au milieu du papier",
      moments: [
        { at: 0, what: "la première image déjà coupée en 12 tirages sur du papier gris clair" },
        { at: 0.1, what: "l'image suivante remplace les cases une à une dans l'ordre de lecture, une toutes les 3 images, chacune posée de travers puis droite : une image toutes les 1,2 s, jamais tenue" },
        { at: 4.9, what: "la dernière vague ramène la première image : le Reel tourne en boucle" },
      ],
      grade: "warm",
      motion: "fait_main",
      music: "neo-soul lo-fi, soft kick each beat, clap every 4 beats, warm chords, round bass",
      ending: "une boucle : la dernière vague ramène la première image et sa musique s'arrête net, sans fondu",
      why: "Une case change toujours : l'œil suit la vague d'un tirage à l'autre, chaque image passe sans jamais s'arrêter, et la boucle fait revoir le Reel sans qu'on le remarque.",
    },
  }),
  model({
    key: "carte-feutre",
    name: "Carte au feutre",
    pitch: "Une carte tenue devant tes plans, où ton message s'écrit au feutre rouge un mot de plus toutes les deux coupes.",
    needs: "15 à 20 photos ou petits passages de vidéo de ton lieu et de tes produits",
    files: [10, 20],
    pair: "feutre",
    example: "C-carte",
    finish: { name: "Flash chaud", hint: "couleurs franches, un peu de flash, grain", contrast: 0.12, saturation: 0.12, warmth: 0.12, flash: 0.25, grain: 0.3, grain_size: "medium" },
    look: {
      name: "carte écrite au feutre",
      format: "message",
      hook: { kind: "mystère", what: "une carte blanche pliée tenue devant le premier plan, le premier mot qui s'y écrit au feutre" },
      text: {
        amount: "un message tenu",
        composition: "une seule phrase écrite au feutre rouge en capitales, sur une carte de papier blanc au centre, un mot de plus toutes les deux coupes",
        case: "upper",
        weight: "bold",
        stroke: "thick",
        tilt: -3,
      },
      colors: ["#d2122e"],
      layout: "plein cadre, avec une carte de papier blanc posée au centre par-dessus chaque plan, qui bouge un peu à chaque coupe comme tenue à la main",
      moments: [
        { at: 0, what: "une coupe toutes les 0,25 s environ, en stop motion : un plan différent à chaque fois sous la même carte" },
        { at: 0.5, what: "un mot de plus au feutre rouge toutes les deux coupes, jusqu'à la phrase entière ; la carte se décale de quelques pixels et tourne d'un degré à chaque coupe" },
        { at: 6, what: "la phrase entière reste sur la carte pendant les dernières coupes" },
      ],
      camera: "à la main",
      grade: "flash",
      motion: "fait_main",
      music: "upbeat funk soul, punchy drums and slap bass",
      ending: "la carte avec la phrase entière sur un dernier plan, tenue une seconde",
      why: "Le rythme en stop motion accroche et la phrase se lit en se construisant : on attend le mot suivant, et l'invitation finit écrite à la main.",
      // In the model the card is real, held by a hand in front of each shot.
      to_film: "ta main qui tient une carte blanche devant tes plans, comme dans le modèle",
      to_film_else: "je dessine la carte par-dessus tes images",
    },
  }),
  model({
    key: "pile",
    name: "Pile de photos",
    // 11: written again on its original's fiche (v2 of its skill): a burst slowing down for its nine last, each photo
    // leaving 4 s after it landed (no full pile held), the pile empty on a dry hit, her words in her colour (no colours
    // here: a faithful copy would put the original's yellow back on them), 20 to 40 files; its tempo (120, the grid of its
    // landmarks: its music has none), no grade.
    pitch: "Tes photos se posent en rafale sur une page blanche, du haut vers le bas, puis repartent au même rythme, derrière quelques mots en très grand qui disent qui tu es.",
    needs: "20 à 40 photos (ou courtes vidéos) de ton travail",
    files: [20, 40],
    pair: "affiche",
    example: "Y-pile-titre",
    // Its landmarks on this grid (docs/fiches/pile.md): its original's music has no beat, a clicking that slows down.
    tempo: 120,
    finish: { name: "Naturel" },
    look: {
      name: "pile de photos et titre",
      format: "collage",
      hook: { kind: "promesse", what: "quelques mots en très grandes capitales sur une page blanche, et ses photos qui se posent en rafale derrière eux" },
      text: {
        amount: "un message tenu",
        composition: "2 à 4 mots courts en capitales grasses très étroites, un par ligne en deux paires, au centre, devant toutes les photos de la première image à la dernière",
        case: "upper",
        weight: "black",
        tracking: "tight",
      },
      layout: "une page blanche unie où ses photos se posent une à une en zigzag du haut vers le bas, chacune par-dessus la précédente dont elle couvre la moitié, derrière ses mots en très grand",
      moments: [
        { at: 0, what: "la page blanche et ses mots seuls, trois images" },
        { at: 0.1, what: "ses photos se posent d'un coup en rafale, une toutes les 2 ou 3 images, du haut de la page vers le bas en zigzag, recadrées au carré, sans bord, sans ombre ni rotation" },
        { at: 2.53, what: "les neuf dernières de plus en plus lentement, sur un cliquetis qui ralentit" },
        { at: 4.1, what: "chaque photo repart d'un coup 4 s après s'être posée : la pile se vide par le haut pendant que les dernières se posent en bas, jamais pleine et tenue" },
        { at: 7.97, what: "la pile vide sur un coup sec, la dernière photo seule un instant, puis ses mots seuls sur le blanc, la musique plus douce" },
      ],
      motion: "energique",
      music: "airy minimal electronica, held warm synth chord, dry ticking pulse, no drums",
      ending: "la pile vide sur un coup sec, puis ses mots seuls sur le blanc une seconde",
      why: "Une rafale de travail en neuf secondes : on voit tout sans se lasser, la rafale qui ralentit tient l'œil, et les quelques mots disent qui on est.",
    },
  }),
  model({
    key: "photo-dump",
    name: "Photo dump",
    pitch: "Tes photos et vidéos une à une au centre d'un fond clair, chacune à sa taille, comme un carnet qu'on feuillette.",
    needs: "10 à 20 photos et petits passages de vidéo de ta semaine",
    files: [8, 20],
    pair: "grotesque",
    example: "AA-photo-dump",
    tempo: 115,
    finish: { name: "Argentique clair", hint: "noirs un peu levés, couleurs douces, grain", contrast: -0.04, saturation: -0.06, warmth: 0.08, fade: 0.12, grain: 0.3, grain_size: "fine" },
    look: {
      name: "photo dump",
      format: "collage",
      hook: { kind: "geste", what: "une première photo posée au centre d'un fond gris clair, et la suivante une demi-seconde après" },
      text: { amount: "aucun", composition: "aucun texte" },
      layout: "un fond gris très clair, avec une seule photo ou vidéo à la fois posée au centre, à sa forme et à une taille qui change",
      moments: [{ at: 0, what: "une image toutes les 0,5 s, d'un coup, au centre du fond clair, chacune à sa forme et à sa taille, sans bord, sans ombre ni texte" }],
      motion: "epure",
      grade: "film",
      music: "dreamy bedroom pop, soft drum machine",
      ending: "la dernière image tenue une seconde",
      why: "Le format d'un carnet intime : rapide, sans texte, on a envie de revoir pour tout saisir.",
    },
  }),
  model({
    key: "table",
    name: "Photos posées sur la table",
    pitch: "Tes photos tirées sont posées une à une sur ta table, avec deux mots manuscrits, puis on passe en plans partagés.",
    needs: "une vidéo de ta table ou de ton comptoir, et 4 à 8 photos de tes plats ou produits",
    files: [5, 10],
    pair: "editorial",
    example: "W-table",
    finish: { name: "Restaurant du soir", hint: "lumière chaude et sombre, rouges profonds, grain", exposure: -0.03, contrast: 0.14, saturation: 0.04, warmth: 0.22, vignette: 0.45, grain: 0.3, grain_size: "fine" },
    look: {
      name: "photos posées sur la table",
      format: "collage",
      hook: { kind: "geste", what: "une photo tirée posée sur la nappe, puis une autre par-dessus" },
      text: {
        amount: "une ligne",
        composition: "deux petits mots manuscrits blancs de part et d'autre de la pile, à mi-hauteur",
        weight: "regular",
        stroke: "thin",
      },
      layout: "un plan de table en plein cadre, avec des photos tirées posées une à une en pile au centre par-dessus, puis un écran partagé en deux",
      moments: [
        { at: 0, what: "des photos tirées tombent une à une sur la nappe au centre, toutes les 0,3 s, un peu tournées, avec une ombre douce" },
        { at: 0.4, what: "deux petits mots manuscrits blancs à gauche et à droite de la pile" },
        { at: 2.6, what: "écran partagé en deux, deux plans côte à côte qui changent sur les coupes" },
      ],
      grade: "moody",
      motion: "fait_main",
      music: "smooth jazz-hop, warm Rhodes and soft drums",
      ending: "un gros plan d'un plat tenu deux secondes",
      why: "Le geste de poser des photos sur la table raconte l'endroit avant de le montrer : intime, chic, sans un mot de trop.",
    },
  }),
  model({
    key: "ecran-partage",
    name: "Écran partagé titré",
    // 11: written again on its original's fiche (v2 of its skill): a card cut in two on black (one half above the other
    // for her horizontal files), both halves always cut together and never one alone, a clean end; its tempo (120, the
    // grid of its cuts: its music has no drums nor steady beat), a book serif for its titles, no vignette nor grain.
    pitch: "Une carte coupée en deux : toi ou ton équipe au travail d'un côté, ce que ça donne de l'autre au même moment, et deux petits titres en serif qui se répondent.",
    needs: "4 à 10 vidéos, deux par deux, en vertical de préférence, téléphone posé : toi ou ton équipe au travail, et pour chaque geste ce qu'il donne (le plat, la coupe, le bouquet), posé devant la caméra",
    files: [4, 10],
    pair: "labeur",
    example: "Q-ecran-partage",
    // Its cuts on this grid (docs/fiches/ecran-partage.md): its music has no steady beat.
    tempo: 120,
    finish: { name: "Sombre et chaud", hint: "noirs profonds, tons chauds, plats saturés, sans grain ni coins sombres", contrast: 0.14, warmth: 0.12 },
    look: {
      name: "écran partagé titré",
      format: "autre",
      hook: { kind: "geste", what: "une carte coupée en deux sur du noir : quelqu'un au travail d'un côté, ce que son geste donne de l'autre, au même moment" },
      text: {
        amount: "une ligne",
        composition: "deux petits titres en serif de labeur blanc, romain, la première lettre en capitale, un sur chaque moitié juste sous le milieu de la carte, qui se répondent (qui fait, puis ce que ça donne), tenus tout le Reel",
        weight: "regular",
      },
      layout: "une carte aux coins arrondis sur du noir, coupée en deux moitiés qui se touchent : côte à côte comme l'original, l'une sur l'autre quand ses vidéos sont horizontales",
      moments: [
        { at: 0, what: "la carte et ses deux titres dès la première image : d'un côté quelqu'un au travail, de l'autre le plat qui entre par le bas et se pose au centre" },
        { at: 2.23, what: "les deux moitiés coupent ensemble sur la même image, jamais l'une sans l'autre, jamais un plan seul en plein cadre : une nouvelle paire toutes les deux à trois secondes et demie" },
        { at: 10.67, what: "la dernière paire sur le résultat fini, jusqu'à une fin nette" },
      ],
      camera: "fixe",
      grade: "moody",
      music: "held strings and keys, triplet arpeggios, soft bass on each beat, no drums",
      ending: "la dernière paire sur le résultat fini, une fin nette : ni carte, ni logo, la musique coupée avec la dernière image",
      why: "Le geste et son résultat au même moment : on comprend le savoir-faire sans un mot, et les deux titres le disent en deux mots qui se répondent.",
    },
  }),
  model({
    key: "cadre",
    name: "Cadre dans le cadre",
    // 11: written again on its original's fiche (v2 of its skill): her widest shot frozen in a dark black and white, a
    // frame at its middle a notch larger at each cut, half a beat a picture at 90 BPM (v1 counted 120), the last one full
    // screen at once and the music cut dead; its labels in normal spacing, no grain nor dark corners, no grade over it all.
    pitch: "Ton lieu figé en noir et blanc, et au milieu un cadre sur tes images en couleur qui grandit à chaque coupe, jusqu'à ta plus belle image en plein écran. Deux petites étiquettes restent fixes.",
    needs: "un plan large de ton lieu qui fuit vers le centre (un couloir, ta salle vue de l'entrée), si possible avec une porte ou une fenêtre au fond, puis 2 à 10 photos ou courtes vidéos de ce qui se fait, et une belle image large pour finir",
    files: [4, 12],
    pair: "grotesque",
    example: "J-cadre-dans-le-cadre",
    // Measured on its original (docs/fiches/cadre.md): its attacks on a grid of sixteenth notes, a cut every eighth note.
    tempo: 90,
    finish: { name: "Naturel", hint: "ses images telles quelles, à peine chaudes, sans grain ni coins sombres", warmth: 0.04 },
    look: {
      name: "cadre dans le cadre",
      format: "autre",
      hook: { kind: "mystère", what: "son lieu figé en noir et blanc sombre, et au milieu un petit cadre sans bord sur une image en couleur, qui grandit à chaque coupe" },
      text: {
        amount: "une ligne",
        composition: "deux petites étiquettes en capitales blanches, graisse moyenne, sur la ligne du milieu à 13 % de chaque bord (ce qui se passe à gauche, son nom à droite), fixes tout le Reel, le cadre passant dessous",
        case: "upper",
        weight: "regular",
        tracking: "normal",
      },
      layout: "son plan large figé en noir et blanc plein écran et, au milieu, un cadre debout sans bord qui montre ses images en couleur et grandit à chaque coupe ; couché quand ses images sont en largeur",
      moments: [
        { at: 0, what: "son plan le plus large figé en noir et blanc sombre et contrasté, plein écran ; au milieu, un cadre debout sans bord, à 15 % de la largeur, sur une image en couleur" },
        { at: 0.33, what: "une nouvelle image en couleur dans le cadre à chaque demi-temps ; à chaque coupe, le cadre grandit d'un coup de 5 % de la largeur, rien ne bouge entre deux, jamais un zoom" },
        { at: 5.37, what: "le cadre à 95 % de la largeur, sur le premier temps de la troisième mesure" },
        { at: 5.7, what: "sa plus belle image prend tout l'écran d'un coup, tenue un temps ; la musique coupée net 0,1 s plus tard, la fin muette" },
      ],
      camera: "fixe",
      grade: "natural",
      music: "lo-fi boom bap, steady kick, round bass, mellow chords, hi-hats and claps",
      ending: "sa plus belle image en plein écran d'un coup, tenue un temps, la musique coupée net : la fin muette",
      why: "Une image dans l'image donne de la profondeur et fait entrer dans le lieu, comme une porte qu'on pousse : le cadre qui grandit à chaque coupe tire l'œil jusqu'au plein écran.",
    },
  }),
  model({
    key: "fenetres",
    name: "Fenêtres et étiquettes",
    pitch: "Des fenêtres s'ouvrent sur tes plans pendant que deux étiquettes techniques restent fixes, comme un carnet de voyage.",
    needs: "6 à 12 vidéos de route, de paysage ou de ton quartier",
    files: [5, 14],
    pair: "technique",
    example: "P-fenetres-etiquettes",
    finish: { name: "Voyage", hint: "couleurs un peu désaturées, contraste doux, grain", contrast: 0.06, saturation: -0.08, warmth: 0.06, grain: 0.25, grain_size: "fine", vignette: 0.2 },
    look: {
      name: "fenêtres et étiquettes",
      format: "pov",
      hook: { kind: "pov", what: "un paysage avec deux étiquettes fixes à mi-hauteur, une à gauche et une à droite" },
      text: {
        amount: "une ligne",
        composition: "deux petites étiquettes techniques en capitales condensées (une altitude, des coordonnées, une heure), fixes à mi-hauteur à gauche et à droite pendant tout le Reel",
        case: "upper",
        weight: "regular",
        tracking: "normal",
      },
      layout: "plein cadre, avec des fenêtres posées par-dessus qui montrent un autre plan et deux étiquettes fixes",
      moments: [
        { at: 0, what: "deux étiquettes à mi-hauteur, à gauche et à droite, qui ne bougent plus de tout le Reel" },
        { at: 1.6, what: "une fenêtre rectangulaire s'ouvre dans le plan avec un autre plan dedans, puis prend tout le cadre à la coupe suivante" },
        { at: 4, what: "les plans coupent toutes les 0,7 s sur le temps, les étiquettes restent" },
      ],
      camera: "à la main",
      grade: "natural",
      music: "uplifting indie electronic, driving beat",
      ending: "un dernier plan large, les étiquettes toujours là",
      why: "Les étiquettes fixes donnent un air de film documentaire et situent le lieu, pendant que les fenêtres font avancer le voyage.",
    },
  }),
  model({
    key: "facade",
    name: "Façade qui se construit",
    // 12: written again on its original's fiche (v2 of its skill): 120 BPM, her sign then three far pieces, a burst of
    // twelve, a silence, the last big pieces, each with a note, her front whole on the cut; no grain.
    pitch: "Ta devanture se construit morceau par morceau sur le noir, chaque morceau sur une note : ton enseigne, puis une rafale, un silence, et ta façade entière qui s'anime.",
    needs: "une vidéo fixe de ta devanture filmée de face, de l'autre côté de la rue, 9 s au moins, ton enseigne bien visible",
    files: [1, 3],
    pair: "gaufre",
    example: "H-construit",
    // Counted from its first image (docs/fiches/facade.md): every piece on a beat or half beat at 120.
    tempo: 120,
    finish: { name: "Clair", hint: "lumineux et naturel, contraste doux, noir pur, sans grain", contrast: 0.04, warmth: 0.06 },
    look: {
      name: "façade qui se construit",
      format: "collage",
      hook: { kind: "mystère", what: "un écran noir où apparaît d'un coup son enseigne, puis trois morceaux de sa façade loin l'un de l'autre" },
      text: { amount: "aucun", composition: "aucun texte pendant la construction, son nom seulement sur un morceau du noir s'il le faut" },
      layout: "un fond noir, avec des morceaux de sa façade posés d'un coup à leur place, sa vidéo jouant dedans, jusqu'à l'image entière ; en bande sur le noir si sa vidéo est horizontale",
      moments: [
        { at: 0, what: "son enseigne apparaît d'un coup sur le noir, puis trois éléments de sa façade loin l'un de l'autre, lentement, chacun sur une note" },
        { at: 2.8, what: "une rafale de douze morceaux : ses autres éléments, puis des bandes le long de ses lignes (le trottoir, un côté, le mur)" },
        { at: 4.4, what: "un silence, rien de nouveau" },
        { at: 5.3, what: "les trois derniers grands morceaux (la rue, un tiers du haut, tout ce qui reste noir), sur trois temps" },
        { at: 6.4, what: "sa façade entière, caméra fixe, tenue jusqu'à la coupe à 9 s, puis ses autres plans, une mesure chacun" },
      ],
      grade: "bright",
      music: "warm piano chords and harp arpeggios, soft bass on every beat, no drums",
      ending: "sa devanture entière, tenue, coupée net sur le temps",
      why: "On voit le lieu naître morceau par morceau : la curiosité tient jusqu'à l'image entière, qui devient vivante.",
    },
  }),
  model({
    key: "gaufre",
    name: "Titre gaufré",
    pitch: "Tes plans, puis ton nom pressé dans un papier de couleur et encré lettre à lettre, comme un faire-part.",
    needs: "2 à 6 vidéos ou photos de ton lieu ou de ton travail",
    files: [1, 6],
    pair: "gaufre",
    example: "I-gaufre",
    tempo: 84,
    finish: { name: "Doux", hint: "lumière douce et chaude", contrast: 0.04, warmth: 0.1 },
    look: {
      name: "titre gaufré sur papier",
      format: "message",
      hook: { kind: "geste", what: "un plan calme, puis un papier de couleur où un mot apparaît en relief" },
      text: {
        amount: "une ligne",
        composition: "un seul mot serif très gras au centre du papier, pressé en relief puis encré, et dessous une ligne en petites capitales très espacées",
        weight: "black",
        tracking: "tight",
      },
      colors: ["#8a2c12", "#f2c9a8"],
      layout: "des plans en plein cadre, puis un papier de couleur uni plein cadre où un titre est gaufré",
      moments: [
        { at: 0, what: "un ou deux plans calmes en plein cadre" },
        { at: 1, what: "un papier de couleur pêche plein cadre, grain du papier visible ; le titre y apparaît pressé en relief, sans encre" },
        { at: 1.3, what: "l'encre rouille entre dans les lettres une à une, puis la petite ligne dessous s'encre à son tour" },
      ],
      motion: "fait_main",
      music: "soft ambient piano, warm and intimate",
      ending: "le titre encré sur le papier, tenu deux secondes",
      why: "La matière du papier fait artisanal et premium : on a envie de toucher l'écran.",
    },
  }),
  model({
    key: "mot-cle",
    name: "Mot clé en grand",
    pitch: "Tu parles face caméra devant un fond uni, et le mot important de chaque phrase s'affiche en grand au-dessus de ta tête.",
    needs: "une vidéo de toi qui parles face caméra, devant un mur ou un fond uni",
    files: [1, 3],
    pair: "condensee-geometrique",
    example: "K-kinetic",
    finish: { name: "Studio", hint: "couleurs franches, contraste propre", contrast: 0.1, saturation: 0.08 },
    look: {
      name: "mot clé au-dessus de la tête",
      format: "raconte",
      voice: "quelqu'un parle",
      hook: { kind: "promesse", what: "la personne assise face caméra, et une petite phrase qui s'écrit mot à mot au-dessus de sa tête" },
      text: {
        amount: "plusieurs",
        composition: "au-dessus de la tête, une petite phrase qui apparaît mot à mot, puis le mot clé en très grand, chacun dans la police qu'il évoque ; les sous-titres de ce qui est dit en tout petit en bas",
        case: "normal",
        weight: "black",
        subtitles: true,
      },
      layout: "un seul plan fixe en plein cadre, la personne assise devant un fond uni, avec des mots posés par-dessus au-dessus de sa tête",
      moments: [
        { at: 0, what: "une petite phrase blanche apparaît mot à mot au-dessus de la tête, en suivant la voix" },
        { at: 3.5, what: "le mot clé de la phrase en très grand, blanc, au même endroit, qui remplace la petite phrase ; un nouveau mot clé à chaque idée" },
        { at: 19, what: "pour finir, un chiffre très condensé à côté de trois mots fins empilés" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "energique",
      music: "laid-back hip-hop beat, soft and low under the voice",
      ending: "le chiffre et ses trois mots, tenus deux secondes",
      why: "Chaque idée a son mot en grand : on retient ce qui est dit même sans le son, et la personne reste au centre.",
    },
  }),
  model({
    key: "frappe",
    name: "Lieu tapé lettre à lettre",
    // 8: its original's orange (In-N-Out's) left to it (Tristan: what belongs to the original's own visual is never
    // copied): her name in her colour, a faithful copy too.
    pitch: "Ce qui fait ton lieu ressort morceau par morceau (les lettres de ton enseigne, tes tasses, ta vitrine), puis ton nom se tape lettre à lettre dans le ciel, dans ta couleur, et on coupe sur ta devanture.",
    needs: "6 à 12 vidéos de ton lieu et de ton quartier : un plan large au soleil, ton enseigne de près, un plan avec du ciel, ta devanture le soir, des détails, du monde",
    files: [5, 12],
    pair: "affiche",
    example: "U-frappe",
    finish: { name: "Été", hint: "couleurs franches, lumière chaude, ciel bleu", contrast: 0.1, saturation: 0.12, warmth: 0.12 },
    look: {
      name: "lieu tapé lettre à lettre",
      format: "pov",
      hook: { kind: "pov", what: "un plan large de son lieu au soleil, puis son enseigne dont les lettres ressortent une à une" },
      text: {
        amount: "une ligne",
        composition: "le nom du lieu tapé lettre à lettre en capitales grasses de sa couleur, petit, posé dans le ciel ou sur un mur du plan, puis coupé",
        case: "upper",
        weight: "black",
        tracking: "tight",
      },
      layout: "plein cadre, avec le nom du lieu tapé par-dessus un plan avant de couper sur ce lieu",
      moments: [
        { at: 0, what: "des plans de rue ensoleillés coupés sur le temps, une coupe toutes les 1,3 s" },
        { at: 3.4, what: "sur un plan large, le nom du lieu se tape lettre à lettre à environ 4,5 lettres par seconde, à un rythme irrégulier comme une vraie main, sans curseur" },
        { at: 5.2, what: "coupe nette sur le lieu dont on vient de taper le nom" },
      ],
      camera: "à la main",
      grade: "warm",
      motion: "energique",
      music: "sunny west coast hip-hop, bouncy bass",
      ending: "l'intérieur du lieu, tenu deux secondes",
      why: "Taper le nom crée une attente que la coupe suivante récompense : on découvre le lieu au moment exact où on le lit.",
    },
  }),
  model({
    key: "titre-derriere",
    // Renamed on its original's fiche (Tristan: « ok »): the city passes in front of the title, not a person.
    // 11: written again on its fiche (v2 of its skill): horizontal 4:3 on black when her videos are, its title rising onto
    // a hit in its blood red behind her scenery, the scenery in white paper piece by piece, a wave over its letters, its
    // music stopped one beat a bar, a burst in sixths of a beat, a dead cut; its tempo (82,9: v1 counted 96), warm and
    // contrasted with cream highlights and bluish shadows, without the grain nor the dark corners of « Ciné chaud ».
    name: "Titre derrière le décor",
    pitch: "Un titre géant qui monte dans le ciel de ta rue ou de ton paysage, derrière les toits, les arbres ou les collines, puis le décor qui devient papier blanc morceau par morceau et une rafale de plans.",
    needs: "un plan large et fixe de ta rue, de ta devanture, ou d'un paysage quand ça a du sens (tes vignes, ta montagne), avec du ciel en haut, des toits ou des arbres qui y montent et quelqu'un qui entre, et 10 à 15 autres plans",
    files: [5, 14],
    pair: "geante-script",
    example: "derriere",
    // Measured on its original (docs/fiches/titre-derriere.md): 13 hits on this grid within 28 ms, a stop every bar.
    tempo: 82.9,
    finish: { name: "Heure dorée", hint: "chaud et contrasté, hautes lumières crème, ombres un peu bleutées, sans grain ni coins sombres", contrast: 0.16, saturation: -0.04, warmth: 0.12, shadows: "#0B0B13", highlights: "#E9D8C2", split: 0.2 },
    look: {
      name: "titre derrière le décor",
      format: "pov",
      hook: { kind: "mystère", what: "un nom de lieu géant qui monte d'en bas dans le ciel sur un coup, et le décor qui passe devant lui" },
      text: {
        amount: "une ligne",
        composition: "un nom de lieu en capitales noires très grasses, rouge sang, sur toute la largeur dans le ciel, son pied derrière ce qui monte du décor ; trois petits mots au stylo fin entre deux petites croix de chaque côté, juste au-dessus",
        case: "upper",
        weight: "black",
        tracking: "tight",
      },
      colors: ["#640005"],
      layout: "un titre géant posé dans le ciel du premier plan, derrière le décor qui passe devant lui, en 4:3 sur du noir comme l'original quand ses vidéos sont horizontales",
      moments: [
        { at: 0, what: "un plan large et fixe de sa rue, en silence, un souffle grave qui monte" },
        { at: 0.33, what: "le titre monte d'en bas en trois images, flou, et se pose sur un coup, derrière les toits ; ses petits mots au stylo une image après" },
        { at: 1.57, what: "dès la reprise de la musique, le décor devient papier blanc morceau par morceau, de gauche à droite, puis une vague blanche passe sur les lettres, une à la fois" },
        { at: 3.37, what: "le titre part avec la coupe ; un plan calme pendant que la musique s'arrête un temps, comme à chaque mesure" },
        { at: 4.43, what: "trois plans éclair d'un quart de temps, puis un plan fixe où ce qui se répète blanchit pièce par pièce en remontant" },
        { at: 6.23, what: "son enseigne qui clignote en blanc une image sur deux quand la musique s'arrête, puis un plan qui avance vers sa porte, ouvert sur un flou de zoom" },
        { at: 7.37, what: "un mur dont les cadres blanchissent un à un, l'objet devant qui flashe en blanc deux fois, puis la silhouette blanche de la personne du plan suivant, à sa place" },
        { at: 9.17, what: "cette personne en contre-jour, la musique arrêtée un temps" },
        { at: 10.2, what: "une rafale de onze plans très courts, un tous les sixièmes de temps" },
        { at: 11.53, what: "un dernier plan court, quelqu'un de près devant une vue, coupé net après le dernier coup" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "energique",
      music: "lo-fi hip-hop beat, dusty drums, warm bass, a kick on every beat",
      ending: "un dernier plan court, quelqu'un de près devant une vue, coupé net juste après le dernier coup ; ni carte, ni logo",
      why: "Le titre derrière le décor fait couverture de magazine dès la première seconde, le papier blanc qui court sur les choses tient l'œil, et la rafale finale donne envie de voir le lieu.",
    },
  }),
  model({
    key: "journee",
    name: "Une journée chez toi",
    // 10: written again on its original's fiche (v2 of its skill): horizontal 4:3 on black when her videos are, its tempo
    // (136,8, Gemini heard 115), a burst of things alike, blurred passes over the cuts, the title fading in behind one,
    // flashes and film burns with a click, her day into night; no grain nor dark corners its original does not have.
    pitch: "Une rafale de choses pareilles, un titre rouge élégant qui apparaît derrière un passage flou, puis ta journée en plans courts, avec des flashs photo, jusqu'à la nuit.",
    needs: "10 à 16 vidéos de ta journée, à l'horizontale de préférence : plusieurs fois la même chose côte à côte (tes tasses, tes fenêtres), ton lieu de jour puis de nuit, des gens et des gestes",
    files: [6, 16],
    pair: "didone",
    example: "S-journee",
    // Measured on its original (docs/fiches/journee.md): a beat every 0,439 s; its cuts follow the music by ear.
    tempo: 136.8,
    finish: { name: "Journée", hint: "crème, bleu nuit, contraste doux, sans grain", contrast: 0.06, saturation: -0.08, warmth: 0.1, fade: 0.06, shadows: "#131C25", highlights: "#EAD2AD", split: 0.35 },
    look: {
      name: "une journée, titre derrière un flou",
      format: "pov",
      hook: { kind: "mystère", what: "une rafale de choses pareilles, une par image, puis un titre rouge élégant qui apparaît derrière un passage flou" },
      text: {
        amount: "une ligne",
        composition: "un nom de lieu en serif didone rouge, capitales, au milieu de l'image, avec quelques petits mots écrits à la main au-dessus de sa première lettre",
        case: "upper",
        weight: "bold",
        tracking: "tight",
      },
      colors: ["#fa010c"],
      layout: "4:3 horizontal sur du noir comme l'original, plein cadre si ses vidéos sont verticales",
      moments: [
        { at: 0, what: "une rafale de choses pareilles, une par image à la même place, puis une bande floue passe devant l'objectif et cache la coupe" },
        { at: 1.47, what: "le titre rouge apparaît en fondu derrière la bande qui repart, avec un déclic, et reste sur un plan sombre" },
        { at: 2.5, what: "sa journée en plans courts, des flashs d'appareil photo et des brûlures de pellicule sur les coupes, chacun avec son déclic" },
        { at: 12.2, what: "son lieu de jour puis de nuit, au même endroit de l'image, la musique étouffée qui s'éteint" },
      ],
      camera: "mixte",
      grade: "film",
      motion: "chaleureux",
      music: "retro French instrumental, tremolo chords, soft bass on every beat, no drums",
      ending: "son lieu de nuit, éclairé, pendant que la musique s'éteint ; ni noir, ni logo",
      why: "Un petit film de sa journée : une rafale qui accroche, un titre de cinéma, des flashs comme des photos prises sur le vif, et la nuit qui tombe.",
    },
  }),
  model({
    key: "plans-fixes",
    name: "Plans fixes de cinéma",
    // 9: written again on its original's fiche (v3 of its skill): horizontal 4:3 on black when her videos are, its tempo, its
    // bold serif under spaced small words, no warmth, grain nor vignette its original does not have.
    pitch: "Des plans fixes, la caméra posée, coupés sur la musique, en horizontal comme au cinéma, et un petit titre qui arrive mot par mot au centre.",
    needs: "5 à 10 vidéos fixes (posées, sans bouger) de ton lieu et de ta rue, idéalement en fin de journée",
    files: [4, 10],
    pair: "serif-grasse",
    example: "D-fixes",
    // Measured on its original (docs/fiches/plans-fixes.md): every cut and every word on a beat or half beat at 64,6.
    tempo: 64.6,
    finish: { name: "Plans de cinéma", hint: "contrasté, couleurs riches, chaque plan dans sa lumière", contrast: 0.1, saturation: 0.08 },
    look: {
      name: "plans fixes et titre serif",
      format: "message",
      hook: { kind: "promesse", what: "un plan fixe large à l'heure dorée, et un petit titre serif qui apparaît au centre" },
      text: {
        amount: "une ligne",
        composition: "un petit titre au centre en deux niveaux : trois petits mots sans serif au-dessus, un ou deux mots en serif dessous, blancs, sur le premier plan",
        weight: "bold",
      },
      layout: "plein cadre, des plans fixes l'un après l'autre, en 4:3 sur du noir quand ses vidéos sont horizontales",
      moments: [
        { at: 0, what: "le premier plan fixe tenu 4 s, le petit titre apparaît au centre, mot par mot" },
        { at: 4.2, what: "des plans fixes coupés toutes les secondes" },
      ],
      camera: "fixe",
      grade: "natural",
      music: "mellow electric piano chords, slow tremolo, round bass on each beat, no drums",
      ending: "un plan de nuit, et tout petit au centre une invitation à suivre le compte",
      why: "La caméra ne bouge pas, le monde bouge : c'est calme, beau et on reste jusqu'au bout.",
    },
  }),
  model({
    key: "coups-de-fouet",
    name: "Ville en coups de fouet",
    // 11: written again on its original's fiche (v2 of its skill): 84 BPM (v1 counted 104), horizontal 4:3 on black when
    // her videos are, its name still in her sky while the picture pushes in, its whip flashes and white flashes, no grain.
    pitch: "Ton lieu comme une ville en coups de fouet : son nom en blanc très condensé posé dans le ciel, puis tes plans d'une seconde enchaînés en flashs blancs et fouets éclair, jusqu'à un dernier plan calme.",
    needs: "8 à 15 vidéos de ta rue et de ton lieu : un plan qui défile, un plan large avec du ciel, des passants, un balayage rapide, un plan calme pour finir",
    files: [6, 16],
    pair: "cinema",
    example: "V-fouet",
    // Its grid measured on its original (docs/fiches/coups-de-fouet.md): a double eighth every 0,1786 s.
    tempo: 84,
    finish: { name: "Ville", hint: "film retenu, couleurs douces, coins sombres, sans grain", contrast: 0.14, saturation: -0.08, warmth: 0.05, vignette: 0.25 },
    look: {
      name: "ville en coups de fouet",
      format: "pov",
      hook: { kind: "pov", what: "un plan qui défile, un flash blanc, puis le nom du lieu en capitales blanches très condensées posé au milieu du ciel" },
      text: {
        amount: "une ligne",
        composition: "le nom du lieu en capitales blanches très condensées, au milieu du ciel du deuxième plan, immobile pendant que l'image avance derrière, 1,1 s",
        case: "upper",
        weight: "black",
        tracking: "tight",
      },
      layout: "des plans d'une seconde enchaînés par des coupes franches, des flashs blancs et des fouets éclair (deux images floues et claires), en 4:3 sur du noir quand ses vidéos sont horizontales",
      moments: [
        { at: 0.67, what: "un flash blanc, puis le nom posé dans le ciel, immobile, l'image qui pousse derrière" },
        { at: 1.8, what: "un fouet éclair, puis des plans d'une seconde : une contre-plongée en noir et blanc, un plan qui arrive en filant, des flashs blancs" },
        { at: 8.6, what: "un fouet éclair : la percussion entre sur un détail de couleur ; un passant en noir et blanc, avec des images fantômes" },
        { at: 10.8, what: "sa rue calme pendant que la percussion se tait, puis un fouet éclair : elle revient sur une rame qui file" },
        { at: 17.1, what: "un fouet saccadé, ses images tenues, fondu à l'entrée et à la sortie" },
        { at: 19.9, what: "un dernier plan large et calme tenu 3,4 s, le son qui s'éteint" },
      ],
      camera: "à la main",
      transitions: "effets",
      grade: "film",
      motion: "energique",
      music: "cinematic ambient pad, light crisp percussion, soft kick on every beat",
      ending: "un plan large et calme tenu 3,4 s, le son qui s'éteint",
      why: "L'énergie d'une ville en vingt secondes : chaque fouet éclair et chaque flash donnent envie de voir le plan suivant, et le nom posé dans le ciel dit où l'on est.",
    },
  }),
  model({
    key: "tourne",
    // Renamed on its original's fiche (Tristan: « ok »): two tones (blue-green and cream), its colour kept where it counts.
    // 11: written again on its fiche (v2 of its skill): its tempo (118,3: v1 took 79), its quarter turn always clockwise,
    // its strobe, its burst on the beat, its last shot held without a card; its two tones as a finish for the chain (its
    // code draws them and takes the whole finish out), no grain nor dark corners, no grade over its shots (it would warm
    // and dull its colour shots under its own tones), its tones in words rather than a black and white.
    name: "Quart de tour, deux tons",
    pitch: "Tes plans en largeur tournés d'un quart de tour pour remplir l'écran, en deux tons bleu-vert et crème, la couleur gardée là où elle compte, coupés sur le rythme.",
    needs: "15 à 25 vidéos filmées en largeur : ta route, ton lieu, ta rue, des matières, des gestes, et deux ou trois plans où la couleur compte",
    files: [6, 16],
    pair: "cinema",
    example: "T-tourne",
    // Measured on its original (docs/fiches/tourne.md): 14 hits of its beat on a grid of sixteenth notes within 26 ms.
    tempo: 118.3,
    finish: { name: "Deux tons", hint: "bleu-vert et crème, noirs profonds, blancs jamais brûlés, sans grain", exposure: -0.08, saturation: -1, shadows: "#6A7F87", highlights: "#87874C", split: 1 },
    look: {
      name: "quart de tour, deux tons",
      format: "autre",
      hook: { kind: "geste", what: "des plans tournés d'un quart de tour qui filent sous un stroboscope : on met une seconde à reconnaître ce qu'on voit" },
      text: { amount: "aucun", composition: "aucun texte" },
      filter: "deux tons : noirs profonds, ombres bleu-vert, gris vert-de-gris, hautes lumières crème, blancs jamais brûlés ; la couleur gardée sur quelques plans où elle compte",
      layout: "des plans filmés en largeur tournés d'un quart de tour, toujours dans le même sens, pour remplir le cadre vertical, en deux tons bleu-vert et crème, la couleur gardée sur quelques plans",
      moments: [
        { at: 0, what: "quatre plans tournés qui filent sous un stroboscope, une image surexposée sur deux puis plus rarement, sur un roulement qui monte" },
        { at: 0.8, what: "sept plans d'une à deux secondes sur une musique étouffée : les deux premiers en couleur, chacun sur un grand coup, une vidéo debout retournée la tête en bas, un flou de passage" },
        { at: 5.03, what: "un flash blanc de deux images après un plan qui se floute" },
        { at: 6.6, what: "la musique s'ouvre : une rafale de seize plans en huit temps, sur les quarts de temps, avec un zoom coup de poing, un flash, deux plans en couleur et un filé" },
        { at: 10.63, what: "le dernier flash, la musique de nouveau étouffée : le dernier plan tenu jusqu'au bout" },
      ],
      grade: "natural",
      motion: "energique",
      music: "cinematic electronic, held pad, dry off-beat hits, deep bass on every beat",
      ending: "le dernier plan tourné, tenu deux secondes jusqu'au bout, la musique coupée net avec l'image ; ni texte, ni carton",
      why: "Le quart de tour et les deux tons rendent étrange ce qu'on voit tous les jours, la couleur gardée là où elle compte attire l'œil, et la rafale sur le rythme emporte jusqu'au dernier plan.",
    },
  }),
  model({
    key: "nike",
    name: "Montage sport noir et blanc",
    pitch: "Noir et blanc contrasté, une touche de rouge, ralentis saccadés, images flash : l'énergie d'une pub de sport, avec tes images.",
    needs: "6 à 12 vidéos avec du mouvement (un geste, un service, un effort), filmées sans trop trembler",
    files: [5, 14],
    pair: "cinema",
    example: "F-nike",
    tempo: 120,
    finish: { name: "Noir et blanc dur", hint: "noir et blanc très contrasté, grain fort", preset: "bw", saturation: -1, contrast: 0.4, grain: 0.5, grain_size: "medium", vignette: 0.35 },
    look: {
      name: "montage sport noir et blanc",
      format: "autre",
      hook: { kind: "geste", what: "un geste fort en noir et blanc, figé une fraction de seconde, puis un flash" },
      text: { amount: "une ligne", composition: "un ou deux mots en capitales très condensées, un par plan, coupés sur le temps", case: "upper", weight: "black", tracking: "tight" },
      colors: ["#e10600"],
      effect: "bw",
      layout: "plein cadre en noir et blanc, avec du rouge posé par-dessus en mode de fusion sur certains plans",
      moments: [
        { at: 0, what: "des plans en noir et blanc très contrasté ; chaque image tenue deux images pour un ralenti saccadé" },
        { at: 0.7, what: "une image blanche d'une image sur certaines coupes, sur le temps" },
        { at: 1.7, what: "une image figée une demi-seconde au sommet d'un geste, puis ça repart" },
        { at: 3.2, what: "un aplat rouge multiplié sur un plan noir et blanc pendant une seconde" },
      ],
      camera: "mixte",
      transitions: "effets",
      grade: "moody",
      motion: "energique",
      music: "hard-hitting trap beat, heavy 808 and claps",
      ending: "un geste figé sur le dernier temps, puis le noir",
      why: "Le noir et blanc et les ralentis saccadés donnent du poids à chaque geste : c'est l'énergie d'une marque de sport, sans rien inventer.",
      // The rays of light of the reference are filmed (smoke and a backlight): nothing in an edit makes them.
      to_film: "un ou deux plans en contre-jour avec un peu de vapeur ou de fumée (une tasse qui fume, une machine à café), pour que la lumière fasse des rayons",
      to_film_else: "le montage est là, sans les rayons de lumière",
    },
  }),
  model({
    key: "eventail",
    name: "Éventail de bandes",
    // 11: written again on its original's fiche (v2 of its skill): a star of bands landing one a beat on a bordeaux ground,
    // all windows onto one shot, the whole shot on the drop, its shots two beats each, her name signed on the black; its
    // tempo (119,8), a festive beat, its black and white with blue blacks and no grain (its code draws it and takes the
    // whole finish out: no grade over its shots either, its contrast crushed the blue blacks), an editorial serif for its end.
    pitch: "Ton premier plan apparaît en étoile, une bande par temps sur un fond bordeaux, puis en entier quand la musique entre ; tes plans défilent en noir et blanc sur le rythme, jusqu'à ton nom signé sur le noir.",
    needs: "5 à 12 vidéos de ton lieu, en largeur de préférence : un plan qui ouvre avec un centre et des lignes qui en partent (vu d'en haut, d'en bas ou en perspective), tes lumières, des gens qui bougent, deux plans qui se répondent",
    files: [5, 12],
    pair: "editorial",
    example: "L-eventail",
    // Measured on its original (docs/fiches/eventail.md): its intro's hits within 2 ms of this grid, its kicks within 9.
    tempo: 119.8,
    finish: { name: "Noir et blanc, noirs bleutés", hint: "noir et blanc, noirs bleu nuit, blancs jamais brûlés, sans grain", saturation: -1, contrast: 0.12 },
    look: {
      name: "étoile de fenêtres sur fond bordeaux",
      format: "autre",
      hook: { kind: "geste", what: "un petit carré au milieu d'un fond bordeaux, puis une bande par temps posée d'un coup, toutes des fenêtres sur le même plan, en étoile" },
      text: {
        amount: "une ligne",
        composition: "aucun texte avant la fin : sur le noir, son nom en petit serif blanc au milieu, comme une signature, et deux temps après une ligne rouge plus petite dessous",
        weight: "regular",
      },
      colors: ["#420e0f", "#972f34"],
      layout: "des bandes posées en étoile sur un fond bordeaux, fenêtres sur un seul plan, puis ses plans dans un fin cadre bordeaux, en 16:9 sur du noir comme l'original quand ses vidéos sont horizontales",
      moments: [
        { at: 0.13, what: "un petit carré au milieu du fond bordeaux, fenêtre sur le cœur du plan qui ouvre" },
        { at: 0.63, what: "une bande par temps, posée d'un coup, six en tout, toutes des fenêtres sur ce même plan à sa place : trois traits qui passent par le centre, chacun en deux moitiés, sur sept petits coups de musique seuls" },
        { at: 3.63, what: "le plan entier d'un coup quand le beat entre, un fin cadre bordeaux posé autour jusqu'à la fin" },
        { at: 4.63, what: "ses plans en noir et blanc aux noirs bleutés, coupés tous les deux temps sur la grosse caisse" },
        { at: 8.7, what: "un écran partagé : deux plans qui se répondent côte à côte, chacun une moitié exacte" },
        { at: 12.63, what: "un second plan aux lignes qui partent du centre, rappel de l'ouverture" },
        { at: 15.63, what: "un noir bleuté dans le cadre : son nom en petit serif blanc au milieu, d'un coup, puis deux temps après une ligne rouge brique dessous, la musique qui continue" },
      ],
      grade: "natural",
      motion: "epure",
      music: "festive beat, hand percussion, deep bass, kick on 1 and 3, claps on 2 and 4",
      ending: "un noir bleuté dans le cadre, son nom en petit serif blanc et une ligne rouge brique dessous, tenus huit temps et demi ; la musique continue dessous",
      why: "L'étoile qui se construit sur des coups seuls fait attendre le plan entier, qui tombe avec la musique : c'est graphique, ça claque, et sa signature finit comme un générique.",
    },
  }),
  model({
    key: "coulisses",
    name: "Coulisses façon fiche",
    // 12: written again on its original's fiche (v2 of its skill): no music but its sound effects, each named under the
    // card as it is heard, its 28 cuts, a bold grotesque that is not condensed, its own blue, a 16:9 or square card.
    pitch: "Une fiche technique bleue quadrillée : tes plans dans une carte, le nom de chaque bruitage au moment où on l'entend, et la timeline du montage dessous.",
    needs: "12 à 16 petites vidéos de ton lieu, à l'horizontale de préférence : un plan large et calme pour ouvrir et finir, un plat ou un produit net vu d'en haut, une main qui tient quelque chose, ton enseigne",
    files: [6, 16],
    pair: "coulisses",
    example: "M-coulisses",
    // Its original has no music (sound effects alone, docs/fiches/coulisses.md): its images are counted in beats at it.
    tempo: 120,
    finish: { name: "Net", hint: "contraste propre, sans grain", contrast: 0.08 },
    look: {
      name: "fiche des bruitages",
      format: "autre",
      hook: { kind: "mystère", what: "un grand titre gras sur une fiche bleue quadrillée, et dans une carte le titre de la vidéo qui s'écrit en trois temps, chacun sur son bruitage" },
      text: {
        amount: "plusieurs",
        composition: "un grand mot en capitales grasses, non condensées, aussi large que la carte et posé dessus, deux petits mots sur ses bouts ; sous la carte, le nom du bruitage entendu en capitales blanches ; un petit titre de vidéo dans la carte",
        case: "upper",
        weight: "bold",
        tracking: "tight",
      },
      colors: ["#15017a", "#ffffff"],
      layout: "un fond bleu électrique quadrillé, une carte 16:9 aux coins arrondis au milieu (carrée si ses vidéos sont verticales), une étiquette dessous, la timeline du montage en bas",
      moments: [
        { at: 0, what: "sur un plan large et calme, de petits mots tombent sur un whoosh, son nom clignote sur des déclics, son lieu et son logo apparaissent en trois pops" },
        { at: 1.5, what: "le plan suivant se charge case par case sur des bips d'ordinateur, puis remplit la carte" },
        { at: 3.6, what: "une rafale de plans éclair sur un cliquet, puis un plat détouré arrive à sa place sur le plan d'avant, juste avant la coupe" },
        { at: 6.5, what: "trois flashs photo sur trois déclencheurs, puis une main détourée arrive avant la coupe" },
        { at: 8.2, what: "trois coupes qui hésitent entre deux plans sur des salves de déclics, des coupes dans le silence, l'étiquette effacée" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      motion: "epure",
      music: "none (sound effects only); asked for: a minimal glitchy beat with crisp clicks",
      ending: "le dernier plan, comme le premier, tenu jusqu'au bout : la boucle ; l'étiquette reste",
      why: "On voit et on entend comment le Reel est fait : chaque bruitage nommé au moment où il claque, la tête de lecture qui avance ; c'est curieux, précis, et ça se regarde en boucle.",
    },
  }),
  model({
    key: "interrupteur",
    name: "Interrupteur",
    pitch: "Tu actionnes un grand interrupteur dessiné sur ton mur, et ton logo s'allume.",
    needs: "une vidéo de toi qui lèves la main vers un mur clair, filmée fixe, et ton logo",
    files: [1, 2],
    pair: "grotesque",
    example: "Z-interrupteur",
    tempo: 120,
    finish: { name: "Clair", hint: "lumière douce", contrast: 0.04, warmth: 0.04 },
    look: {
      name: "interrupteur et logo",
      format: "autre",
      hook: { kind: "geste", what: "un grand interrupteur sur un mur clair, et une main qui se lève vers lui" },
      text: { amount: "aucun", composition: "aucun texte : le logo seul" },
      layout: "un seul plan fixe en plein cadre, la personne devant un mur, avec un interrupteur dessiné posé sur le mur puis le logo",
      moments: [
        { at: 0, what: "un grand interrupteur de téléphone, éteint, posé sur le mur" },
        { at: 3.5, what: "la main touche l'interrupteur : il passe au vert et glisse" },
        { at: 4, what: "le logo apparaît en grand sur le mur, en dessous" },
      ],
      camera: "fixe",
      motion: "chaleureux",
      music: "bright playful pop, claps",
      ending: "le logo sur le mur, la personne s'éloigne",
      why: "Un geste simple allume la marque : c'est ludique, mémorable, et ça finit sur le logo.",
    },
  }),
  model({
    key: "interface",
    name: "Interface minimaliste",
    pitch: "Des mots qui sortent du flou sur fond clair, une liste qui défile, puis ton profil et un curseur qui clique « S'abonner ».",
    needs: "ta photo de profil ou ton logo, et ce que tu fais en trois mots",
    files: [0, 2],
    pair: "grotesque",
    example: "AB-interface",
    tempo: 100,
    finish: { name: "Net", hint: "image propre", contrast: 0.02 },
    look: {
      name: "interface minimaliste",
      format: "autre",
      hook: { kind: "promesse", what: "deux mots qui sortent du flou au centre d'un écran blanc cassé" },
      text: {
        amount: "plusieurs",
        composition: "des mots sans serif petits et nets au centre d'un fond clair, un mot en serif italique dans une phrase, puis une liste qui défile comme une machine à sous",
        weight: "regular",
        tracking: "tight",
        stress: "serif",
      },
      layout: "pur motion design sur un fond clair : des mots, une carte de profil et un curseur",
      moments: [
        { at: 0, what: "deux mots sortent du flou au centre" },
        { at: 2, what: "une liste de trois savoir-faire défile verticalement, celui du milieu net, les autres flous" },
        { at: 5.5, what: "une phrase, un mot en serif italique" },
        { at: 8, what: "une carte de profil s'ouvre au centre ; un curseur arrive et clique sur « S'abonner », qui devient « Abonné »" },
        { at: 11, what: "le nom du compte seul, au centre" },
      ],
      motion: "epure",
      music: "minimal ambient electronic, soft clicks",
      ending: "le nom du compte au centre d'un écran clair",
      why: "Propre comme une appli : on comprend ce que fait la personne et le Reel finit sur le geste qu'on attend, s'abonner.",
    },
  }),
  model({
    key: "pixel",
    name: "Recette cosy, typo pixel",
    // 13: written again on its original's fiche (v2 of its skill): 100 BPM, its steps gesture by gesture, its pixel title
    // landing at once and trembling, its loop; no grain, no dark corners.
    pitch: "Ta recette geste par geste, filmée téléphone posé, un titre en pixels qui tremble sur le plat fini, de petites légendes, et une boucle qui revient au début.",
    needs: "8 à 14 courtes vidéos de ce que tu prépares, téléphone posé : le résultat fini vu d'en haut, chaque étape en quelques gestes",
    files: [4, 12],
    pair: "pixel",
    example: "AC-pixel",
    // Counted on its original (docs/fiches/pixel.md): its 26 shots on a grid at 100.
    tempo: 100,
    finish: { name: "Cosy", hint: "lumière chaude, noirs profonds, sans grain", contrast: 0.08, warmth: 0.25 },
    look: {
      name: "recette cosy en pixels",
      format: "autre",
      hook: { kind: "geste", what: "le plat fini vu d'en haut, et un titre en pixels qui arrive d'un coup et tremble" },
      text: {
        amount: "plusieurs",
        composition: "un titre en pixels sur deux lignes au tiers haut, une petite tête avant et une étoile après, qui tremblent ; deux lignes en machine à écrire ; une petite légende par étape",
        weight: "regular",
      },
      layout: "plein cadre, téléphone posé, ses étapes coupées geste par geste, de petits textes posés par-dessus ; en 16:9 sur du noir si ses vidéos sont en largeur",
      moments: [
        { at: 0, what: "le plat fini vu d'en haut, son titre en pixels arrive d'un coup à la 5e image et tremble" },
        { at: 1.2, what: "ses étapes, chacune en plusieurs gestes courts du même plan, avec sa petite légende" },
        { at: 4.2, what: "la musique se tait un temps, puis repart sans basse jusqu'à la cuisson" },
        { at: 14, what: "la boucle : le dernier plan ramène au premier, la musique s'arrête net" },
      ],
      camera: "fixe",
      grade: "warm",
      motion: "chaleureux",
      music: "soft solo piano, warm and intimate, a soft bass note on every beat, no drums",
      ending: "la boucle : le dernier plan ramène au plat fini du début",
      why: "Doux et intime : les gestes donnent faim, la typo pixel fait sourire, et la boucle fait revoir la recette.",
    },
  }),
  model({
    key: "mots-meles",
    name: "Mots mêlés",
    pitch: "Un plan calme sous une grille de lettres, où des boucles tracées à la main entourent les mots cachés un à un.",
    needs: "une vidéo calme et fixe de ton lieu ou de toi au travail, d'environ 15 secondes",
    files: [1, 2],
    pair: "grotesque",
    example: "A-mots-meles",
    tempo: 80,
    finish: { name: "Doux", hint: "image un peu assombrie, grain fin", exposure: -0.06, contrast: 0.04, saturation: -0.1, grain: 0.25, grain_size: "fine" },
    look: {
      name: "mots mêlés",
      format: "message",
      hook: { kind: "mystère", what: "une grille de lettres posée sur une scène calme : on cherche les mots" },
      text: {
        amount: "un message tenu",
        composition: "une grille de lettres capitales fines et grises sur tout le cadre, les mots cachés entourés une à une d'un trait blanc fait main",
        case: "upper",
        weight: "regular",
        tracking: "wide",
        stress: "marker",
        stroke: "thin",
      },
      layout: "un seul plan fixe en plein cadre, avec une grille de lettres posée par-dessus sur tout le cadre (mots mêlés)",
      moments: [
        { at: 0, what: "la grille de lettres sur toute l'image, le plan calme dessous" },
        { at: 2, what: "un trait blanc fait main entoure un premier mot en 0,6 s ; un nouveau mot toutes les 3 s environ, jusqu'à la phrase entière" },
      ],
      camera: "fixe",
      grade: "moody",
      motion: "fait_main",
      music: "soft lo-fi bedroom pop, slow and dreamy",
      ending: "la grille avec tous les mots entourés, tenue deux secondes",
      why: "On joue avec le Reel : chercher les mots retient l'attention, et la phrase trouvée reste en tête.",
    },
  }),
  model({
    key: "aplat",
    name: "Toi sur un aplat de couleur",
    pitch: "Ta silhouette détourée qui marche sur un grand aplat de couleur vive, puis tes plans encadrés de la même couleur.",
    needs: "une vidéo de toi de dos ou de profil qui marche, et 4 à 8 autres plans",
    files: [3, 10],
    pair: "affiche",
    example: "aplat",
    tempo: 100,
    finish: { name: "Couleurs franches", hint: "contraste et couleurs poussés", contrast: 0.14, saturation: 0.14 },
    look: {
      name: "personne sur aplat",
      format: "collage",
      hook: { kind: "geste", what: "une personne détourée qui marche sur un aplat rouge vif" },
      text: { amount: "aucun", composition: "aucun texte" },
      colors: ["#e30613"],
      layout: "la personne détourée qui marche, posée sur un aplat rouge plein cadre, puis des plans encadrés de rouge",
      moments: [
        { at: 0, what: "la personne détourée qui marche, seule sur un aplat rouge vif plein cadre, avec son ombre" },
        { at: 1.7, what: "le vrai plan revient autour d'elle" },
        { at: 4.4, what: "un plan dans un cadre rouge épais, puis les plans en plein cadre" },
      ],
      camera: "à la main",
      motion: "energique",
      music: "upbeat indie rock, driving guitars",
      ending: "un dernier plan large tenu deux secondes",
      why: "La personne seule sur la couleur arrête le pouce, et la couleur revient en cadre pour signer le Reel.",
    },
  }),
  model({
    key: "detourages",
    // Renamed on its original's fiche (Tristan: « ok »): no cut-out pops in it; a window opens on the place, the name
    // blinks letter by letter behind its scenery, then a burst on the beat.
    name: "Ton nom qui clignote",
    pitch: "Une fenêtre s'ouvre sur ton lieu ou ton paysage, ton nom s'y allume lettre par lettre derrière le décor, puis une rafale de plans sur le rythme.",
    needs: "un plan large et fixe de ton lieu, ou d'un paysage quand ça a du sens (ta plage, ta vallée), avec du ciel au-dessus, et 10 à 20 plans courts qui bougent (des gestes, des matières, ta rue)",
    files: [6, 16],
    pair: "feutre",
    example: "collage",
    finish: { name: "Ville chaude", hint: "contraste doux, chaleur, grain", contrast: 0.1, warmth: 0.1, grain: 0.3, grain_size: "fine" },
    look: {
      name: "détourages qui surgissent",
      format: "collage",
      hook: { kind: "geste", what: "un plan de rue et un objet détouré qui surgit en grand par-dessus" },
      text: { amount: "une ligne", composition: "un petit mot manuscrit blanc à côté d'un détourage, de temps en temps", weight: "regular", stroke: "thin" },
      layout: "plein cadre, avec des objets ou des personnes détourés d'autres images posés en grand par-dessus certains plans, avec un bord blanc",
      moments: [
        { at: 0, what: "des plans de rue coupés toutes les 0,8 s" },
        { at: 1.6, what: "un objet détouré surgit en grand au centre, avec un bord blanc de ciseau, et reste un plan ; un nouveau détourage toutes les 2 s environ, chaque fois à une autre place" },
      ],
      camera: "à la main",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "fait_main",
      music: "groovy indie funk, bouncy bass",
      ending: "un dernier détourage posé sur le plan final",
      why: "Les détourages qui surgissent donnent un rythme de collage fait main et mettent en avant chaque produit.",
    },
  }),
  model({
    key: "createur",
    name: "Face caméra et références",
    pitch: "Tu parles face caméra, et ce dont tu parles apparaît en image découpée à côté de toi, avec des sous-titres sobres.",
    needs: "une vidéo de toi qui parles face caméra, et 3 à 8 images de ce dont tu parles",
    files: [2, 10],
    pair: "grotesque",
    example: "createur",
    tempo: 90,
    finish: { name: "Studio chaud", hint: "contraste propre, chaleur", contrast: 0.1, warmth: 0.08 },
    look: {
      name: "face caméra et références",
      format: "raconte",
      voice: "quelqu'un parle",
      hook: { kind: "promesse", what: "la personne qui parle, et une image découpée qui apparaît à côté d'elle sur ses premiers mots" },
      text: { amount: "plusieurs", composition: "des sous-titres blancs sobres sous le visage, et de temps en temps une image ou un nom posé à côté de la personne", weight: "bold", subtitles: true },
      layout: "la personne détourée qui parle, posée sur un aplat de couleur, avec les images dont elle parle posées par-dessus à côté d'elle",
      moments: [
        { at: 0, what: "la personne détourée qui parle sur un aplat sombre, une image dans une fenêtre aux coins arrondis derrière elle" },
        { at: 6.9, what: "à chaque idée, une nouvelle image posée à côté d'elle, qui reste le temps de la phrase" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "epure",
      music: "chill lo-fi beat, low under the voice",
      ending: "la personne seule, sa dernière phrase",
      why: "On voit ce qui est dit : la personne reste au centre et chaque idée a son image.",
    },
  }),
  model({
    key: "silhouette",
    // Renamed on its original's fiche (Tristan: « ok »): a presentation, a word inside her head, her name behind her.
    name: "Présente-toi",
    pitch: "Ton profil en silhouette d'un seul ton, un mot dans ta tête, puis ton nom qui s'écrit derrière toi et ce que tu fais qui défile.",
    needs: "une vidéo de toi de profil devant un fond clair, téléphone posé (5 s : tu baisses la tête puis tu la relèves), ton nom, ton métier en un mot et 3 à 5 choses que tu fais",
    files: [1, 4],
    pair: "grotesque",
    example: "silhouette",
    tempo: 90,
    finish: { name: "Net", hint: "image propre", contrast: 0.04 },
    look: {
      name: "silhouette et mot",
      format: "collage",
      hook: { kind: "geste", what: "une silhouette noire qui marche sur un fond pâle, et un mot qui s'inverse sur elle" },
      text: { amount: "une ligne", composition: "un seul mot très gras, serré, au centre, blanc, qui s'inverse en passant sur la silhouette", weight: "black", tracking: "tight" },
      layout: "un fond pâle uni, avec la personne détourée en silhouette noire et un mot posé par-dessus",
      moments: [
        { at: 0, what: "la silhouette noire qui marche sur un fond gris très pâle" },
        { at: 0.2, what: "le mot s'allume lettre par lettre en clignotant au centre ; il s'inverse là où la silhouette passe dessous" },
      ],
      camera: "fixe",
      motion: "epure",
      music: "minimal deep house, soft and hypnotic",
      ending: "le mot seul sur le fond pâle",
      why: "Graphique et énigmatique : une silhouette et un mot suffisent à faire un générique.",
    },
  }),
  model({
    key: "vision",
    name: "Vision machine",
    pitch: "Les gens de ta vidéo teintés de bleu dans des cadres de détection, reliés par des traits, puis l'image au trait.",
    needs: "une vidéo fixe d'un lieu où des gens passent",
    files: [1, 3],
    pair: "technique",
    example: "vision",
    tempo: 120,
    finish: { name: "Net", hint: "image propre", contrast: 0.04 },
    look: {
      name: "vision machine",
      format: "collage",
      hook: { kind: "mystère", what: "des gens dans des cadres de détection, comme vus par une machine" },
      text: { amount: "une ligne", composition: "une petite étiquette technique en haut et un mot ou un chiffre en sans serif très grasse qui se décode", case: "normal", weight: "black", tracking: "tight" },
      layout: "un fond blanc, avec les personnes détourées teintées de bleu dans des cadres de détection reliés par des traits, puis le plan redessiné au trait",
      moments: [
        { at: 0, what: "le vrai plan, des cadres noirs autour de chaque personne avec une étiquette" },
        { at: 0.7, what: "le plan disparaît : les personnes seules, teintées de bleu, sur blanc, dans leurs cadres reliés par des traits fins" },
        { at: 1.4, what: "le plan redessiné en traits noirs sur blanc, les personnes toujours teintées" },
      ],
      camera: "fixe",
      motion: "epure",
      music: "glitchy minimal electronic, precise clicks",
      ending: "le plan au trait, les cadres reliés",
      why: "L'image vue par une machine intrigue : c'est moderne et ça donne une lecture neuve d'un lieu ordinaire.",
    },
  }),
];

const BY_KEY = new Map(HOUSE_MODELS.map((m) => [m.key, m]));

/** A house model by its key. */
export const houseModel = (key: string | null | undefined): HouseModel | undefined => (key ? BY_KEY.get(key) : undefined);

/** A house model's finish, as the render takes it. */
export const houseFinish = (model: HouseModel): ReelLook => reelLookSchema.parse(model.finish);

/** A house model's fonts (its pairing). */
export const houseFonts = (model: HouseModel): FontPair | undefined => fontPair(model.pair);

/** A house model as it is kept on her inspiration row: a reading like the reader's, its measures, its finish, its pairing. */
export function houseStyle(model: HouseModel): StolenStyle {
  const measures = HOUSE_MEASURES[model.key] ?? { duration: 0, cuts: [], bpm: null, lufs: null };
  const pair = fontPair(model.pair);
  return {
    look: model.look,
    measures: { ...measures, bpm: measures.bpm ?? model.tempo ?? null },
    reader: STEAL_READER,
    filter_look: houseFinish(model),
    house: { key: model.key, version: HOUSE_VERSION },
    ...(pair ? { fonts: pairFonts(pair) } : {}),
    // Its original's frames, seen by the agents that remake it as a Reel she sends is seen (house-sheets.ts).
    ...(houseSheets(model.key).length ? { sheets: houseSheets(model.key) } : {}),
  };
}

/** What her Reel takes from a house model, in three lines (as for a Reel she sends). */
export const houseLines = (model: HouseModel): string[] => stolenStyleLines(houseStyle(model));

/**
 * What each model is for, and not for (Tristan: « j'espère que le système est assez bien fait pour qu'il puisse bien
 * comprendre le modèle qu'il peut utiliser dans quel contexte ») : read by the art director who picks one (house-pick.ts)
 * and by Edith when she proposes one. In French, as the business would say it.
 */
export const HOUSE_WHEN: Record<string, { pour: string; pas_pour: string }> = {
  decode: { pour: "présenter un lieu, un quartier ou un nom, une ouverture, une rentrée", pas_pour: "une offre à lire en détail, un produit en gros plan, quelqu'un qui parle" },
  "quatre-coins": { pour: "présenter le lieu et son équipe, son adresse, ce qu'on y vit", pas_pour: "des produits seuls, quelqu'un face caméra" },
  mosaique: { pour: "des plats, des produits ou des créations en série, une carte, une collection", pas_pour: "un message à lire, quelqu'un qui parle, un lieu en plan large" },
  "carte-feutre": { pour: "un message de quelques mots qui s'écrit sur ses images (une offre, une nouveauté, un horaire)", pas_pour: "un Reel sans message" },
  pile: { pour: "montrer son travail en série (réalisations, coupes, pièces) avec une phrase courte qui dit qui on est", pas_pour: "des vidéos qui racontent une histoire, une voix" },
  "photo-dump": { pour: "une semaine, un événement, l'envers du décor en vrac, beaucoup de photos", pas_pour: "un message précis, une offre" },
  table: { pour: "des plats ou des produits présentés comme des tirages posés sur sa table, un moment chaleureux", pas_pour: "un lieu, une rue" },
  "ecran-partage": { pour: "le geste et le résultat côte à côte (l'artisan et sa pièce, la coiffeuse et la coupe, le chef et l'assiette)", pas_pour: "un seul sujet, un lieu" },
  cadre: { pour: "faire entrer dans un lieu (un couloir, une salle), une ouverture, des travaux", pas_pour: "sans plan large de son lieu, des produits seuls en gros plan" },
  fenetres: { pour: "une sortie, un quartier, un voyage, des lieux qui défilent", pas_pour: "des produits, une offre" },
  facade: { pour: "une ouverture, un lancement, présenter sa devanture", pas_pour: "sans vidéo fixe de la devanture filmée de face" },
  gaufre: { pour: "une annonce élégante, un nom, une nouvelle collection, comme un faire-part", pas_pour: "un Reel rythmé ou drôle" },
  "mot-cle": { pour: "quelqu'un qui parle face caméra (un conseil, une explication)", pas_pour: "des images sans parole" },
  frappe: { pour: "présenter un lieu au soleil, une terrasse, une saison", pas_pour: "un intérieur sombre, des produits seuls" },
  "titre-derriere": { pour: "un nom de lieu, de quartier ou de région en grand, une rue avec des toits, un paysage, un ciel", pas_pour: "sans plan large et fixe avec du ciel en haut" },
  journee: { pour: "raconter une journée du lieu, du matin au soir, son ambiance", pas_pour: "une offre, un produit seul" },
  "plans-fixes": { pour: "un lieu calme et beau, une ambiance, l'heure dorée", pas_pour: "un Reel rythmé, une annonce" },
  "coups-de-fouet": { pour: "l'énergie d'une rue, d'un quartier, d'un lieu animé", pas_pour: "un lieu calme, un long message" },
  tourne: { pour: "un savoir-faire, des matières, un lieu, un look graphique de cinéma", pas_pour: "sans vidéos filmées en largeur" },
  nike: { pour: "l'effort, le geste, l'énergie (sport, danse, un service en plein rush)", pas_pour: "un lieu calme, des produits" },
  eventail: { pour: "une ouverture graphique, un lieu, une marque qui ose", pas_pour: "un message à lire" },
  coulisses: { pour: "montrer son lieu et ses gestes comme un créateur montre ses coulisses : chaque bruitage nommé, la timeline du montage", pas_pour: "une offre à lire, quelqu'un qui parle, une ambiance calme" },
  interrupteur: { pour: "présenter sa marque, un lancement, son logo qui s'allume", pas_pour: "sans vidéo d'elle qui lève la main vers un mur" },
  interface: { pour: "faire suivre son compte, une app, un service en ligne", pas_pour: "montrer un lieu ou des produits" },
  pixel: { pour: "une recette, une préparation en étapes, une ambiance chaleureuse", pas_pour: "un lieu, une rue, quelqu'un qui parle, des vidéos filmées à la main" },
  "mots-meles": { pour: "un jeu, une devinette, un message caché, un lieu calme", pas_pour: "un Reel rythmé" },
  aplat: { pour: "présenter une personne (la patronne, l'équipe), une marque qui ose la couleur", pas_pour: "sans vidéo d'elle qui marche" },
  detourages: { pour: "présenter un lieu, un paysage ou une sortie avec de l'élan, un nom à faire retenir", pas_pour: "sans plan large et fixe de son lieu ou de son paysage" },
  createur: { pour: "quelqu'un qui explique en parlant, avec des images de ce dont il parle", pas_pour: "des images sans parole" },
  silhouette: { pour: "se présenter, présenter son métier ou quelqu'un de l'équipe", pas_pour: "des produits, un lieu sans personne" },
  vision: { pour: "un lieu fréquenté, un ton tech ou graphique", pas_pour: "un lieu vide" },
};

/** The models for Edith: their key, name, what they do, what they want, and what only she can film for one. */
export function houseModelsForEdith(): { key: string; nom: string; ce_que_ca_fait: string; il_faut: string; pour?: string; pas_pour?: string; a_lui_dire?: string }[] {
  return HOUSE_MODELS.map((m) => {
    const film = filmWords(m.look);
    const when = HOUSE_WHEN[m.key];
    return { key: m.key, nom: m.name, ce_que_ca_fait: m.pitch, il_faut: m.needs, ...(when ? { pour: when.pour, pas_pour: when.pas_pour } : {}), ...(film ? { a_lui_dire: film } : {}) };
  });
}
