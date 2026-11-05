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
/** The catalogue's version: a studio's row written by an older one is rewritten when the model is used again (3: its original's sheets; 4: no brand in a model's name; 5: Mots aux quatre coins as its original; 6: Plans fixes at 65 BPM; 7: four renamed; 8: Lieu tapé without its original's orange; 9: Plans fixes on its fiche; 10: Une journée chez toi on its fiche; 11: ten models on their fiches; 12: Façade qui se construit and Coulisses façon fiche on their fiches; 13: Recette cosy on its fiche; 14: Titre gaufré on its fiche; 15: Mots mêlés and Interrupteur on their fiches; 16: Interface minimaliste and Fenêtres et étiquettes on theirs; 17: Mot clé en grand and Face caméra et références on theirs; 18: Photos posées sur la table and Carte au feutre on theirs; 19: « S'abonner » in Interface minimaliste; 20: the last four on their fiches, Aplat, Détourages, Silhouette and Vision machine). */
export const HOUSE_VERSION = 20;

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
    // 15: written again on its original's fiche (v2 of its skill): an open notebook cut out and laid over her pictures
    // (no hand holding a card, no shadow), a new picture every 3 images in her order, her words one at a time with a new
    // pose of the notebook each, the name she announces in the music's one-beat blank; 135 BPM in half time (its measure
    // said 92, v1 72), a slow 808 beat with its late start and its blank, fading at the end; its red, no grain nor flash
    // over the notebook; nothing to film by hand (the notebook is drawn).
    pitch: "Un carnet ouvert posé sur tes photos qui défilent en stop motion, où ton message s'écrit au feutre rouge, un mot après l'autre.",
    needs: "15 à 25 photos (ou petits passages de vidéo) de ton lieu en action, ce qui compte en haut ou en bas de l'image, et un message de 6 à 9 mots qui finit sur ce que tu annonces",
    files: [10, 25],
    pair: "feutre",
    example: "C-carte",
    // Measured on its original (docs/fiches/carte-feutre.md): its eleven bass hits on a grid of 135, played in half time.
    tempo: 135,
    finish: { name: "Flash chaud", hint: "couleurs franches et chaudes au flash sur ses photos, noirs profonds, sans grain", contrast: 0.12, saturation: 0.12, warmth: 0.12 },
    look: {
      name: "carnet écrit au feutre",
      format: "message",
      hook: { kind: "mystère", what: "un carnet ouvert encore vide posé au milieu de ses photos qui défilent dix fois par seconde : on attend ce qui va s'y écrire" },
      text: {
        amount: "un message tenu",
        composition: "une phrase écrite à la main au feutre rouge en capitales hautes et étroites sur un carnet ouvert au milieu de l'image, deux lignes par page, chaque ligne sur toute la largeur, la dernière (ce qu'elle annonce) la plus grande",
        case: "upper",
        weight: "bold",
        stroke: "thick",
        tilt: 0,
      },
      colors: ["#b20b21"],
      layout: "plein cadre, ses photos en stop motion une toutes les 3 images, et par-dessus un carnet ouvert gris clair, sans ombre, qui change de pose à chaque mot ; en deux bandes pour des images horizontales",
      moments: [
        { at: 0, what: "le carnet ouvert vide, penché à gauche, au milieu de l'image ; dessous, une nouvelle photo toutes les 3 images, toujours dans le même ordre" },
        { at: 0.9, what: "un mot de plus au feutre rouge toutes les 0,8 s environ, chacun sur un changement de photo (un petit mot avec le suivant), le carnet changeant de pose à chaque mot, 4 à 7° à gauche puis à droite" },
        { at: 5.9, what: "le nom de ce qu'elle annonce arrive d'un coup, la plus grande ligne, dans le blanc d'un temps de la musique ; le carnet droit, la phrase entière tenue 3 s, les photos défilent toujours" },
      ],
      camera: "à la main",
      grade: "flash",
      motion: "fait_main",
      music: "slow trap soul beat in half time, long 808 bass, looped guitar, one-beat break",
      ending: "la phrase entière tenue sur la reprise de la musique, les photos défilant toujours, le son qui baisse : ni carte, ni logo, ni noir",
      why: "Le stop motion accroche et la phrase se lit en s'écrivant : on attend le mot suivant, et le nom de ce qu'elle annonce tombe en grand dans le silence de la musique.",
      // Its notebook is drawn by the model (to_film and to_film_else go: there is no hand holding a card in the original).
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
    key: "mon-travail",
    name: "Voici mon travail",
    // Written on its original's fiche (v1 of its skill, docs/fiches/mon-travail.md): the template and the sound of
    // « Pile de photos » on one fixed shot of her standing; her works stack up behind her (cut out in front of them, the
    // last ones over her legs) and leave one by one; her words in her colour, off her face (none of the original's lime nor
    // its words: no colours here); its tempo (120, the grid of its landmarks: its music has none), no grade.
    pitch: "Toi debout dans ton lieu, tes mots en très grand devant toi, et les photos de ton travail qui se posent en rafale derrière toi, puis repartent une à une.",
    needs: "une photo (ou une vidéo d'au moins 6 s) de toi debout dans ton lieu, téléphone posé, et 15 à 40 photos de ton travail",
    files: [16, 41],
    pair: "grotesque",
    example: null,
    // Its landmarks on this grid (docs/fiches/mon-travail.md): its original's music has no beat, a clicking that slows down.
    tempo: 120,
    finish: { name: "Naturel" },
    look: {
      name: "voici mon travail",
      format: "collage",
      hook: { kind: "promesse", what: "elle debout dans son lieu, quelques mots en très grandes capitales devant elle, et ses travaux qui se posent en rafale derrière elle" },
      text: {
        amount: "un message tenu",
        composition: "2 à 4 mots courts en grandes capitales grasses et larges, un par ligne, tous à la même taille, centrés, devant elle et ses travaux de la première image à la dernière",
        case: "upper",
        weight: "bold",
        tracking: "normal",
      },
      layout: "un plan fixe d'elle debout dans son lieu, ses photos posées une à une derrière elle en collage du haut vers le bas, elle détourée devant, les dernières devant ses jambes",
      moments: [
        { at: 0, what: "elle debout dans son lieu et ses mots seuls, trois images" },
        { at: 0.1, what: "ses photos se posent d'un coup derrière elle en rafale, une toutes les 2 ou 3 images, du haut vers le bas en zigzag, au carré, sans bord, sans ombre ni rotation ; elle reste détourée devant" },
        { at: 2.53, what: "les neuf dernières de plus en plus lentement, en bas, les six dernières devant ses jambes, sur un cliquetis qui ralentit" },
        { at: 4.1, what: "chaque photo repart d'un coup 4 s après s'être posée : le collage se vide par le haut pendant que les dernières se posent en bas, jamais plein et tenu" },
        { at: 7.97, what: "le collage vide sur un coup sec, la dernière photo un instant, puis elle seule avec ses mots une seconde, la musique plus douce" },
      ],
      camera: "fixe",
      motion: "energique",
      music: "airy minimal electronica, held warm synth chord, dry ticking pulse, no drums",
      ending: "le collage vide sur un coup sec, puis elle seule avec ses mots une seconde",
      why: "La personne et son travail dans la même image : on voit tout son travail en neuf secondes sans la perdre de vue, la rafale qui ralentit tient l'œil, et ses mots disent ce qu'on regarde.",
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
    // 15: written again on its original's fiche (v2 of its skill): horizontal 4:3 on black when her table's video is in
    // width, ten prints at once at the centre without border nor shadow, eleven a second (not dropping every 0,3 s with a
    // shadow), gone by their light; two jerky quick shots, a burned flash; its split screen side by side, each half at
    // its own speed, the gesture's half cutting alone, its last shot taking the frame from it; 8 to 20 files; its tempo
    // (110, measured), its finish without vignette nor grain (the original has neither).
    pitch: "Tes photos tirées sont posées une à une sur ta table, avec deux mots manuscrits, puis on passe en plans partagés.",
    needs: "une vidéo de ta table ou de ton comptoir filmée posée, 8 à 10 photos de ce que tu fais (une même série), et des vidéos de ton lieu et de tes gestes, chacun de près puis de plus près",
    files: [8, 20],
    pair: "editorial",
    example: "W-table",
    // Measured on its original (docs/fiches/table.md): its hi-hat on every eighth note, its cuts on its beats and half beats.
    tempo: 110,
    finish: { name: "Restaurant du soir", hint: "lumière chaude et sombre, rouges profonds, noirs bouchés, sans grain ni coins sombres", exposure: -0.03, contrast: 0.14, saturation: 0.04, warmth: 0.22 },
    look: {
      name: "photos posées sur la table",
      format: "collage",
      hook: { kind: "geste", what: "sa table filmée posée, deux petits mots écrits à la main de part et d'autre de son milieu, puis ses photos tirées qui s'y posent d'un coup en rafale" },
      text: {
        amount: "une ligne",
        composition: "deux petits mots manuscrits crème au feutre fin, en minuscules aux lettres espacées, de part et d'autre de la pile juste au-dessus du milieu : à gauche ce qui amène son nom, à droite son nom",
        weight: "regular",
        stroke: "thin",
      },
      layout: "sa table en plein cadre, ses photos tirées posées en pile au centre, puis un écran partagé en deux moitiés côte à côte ; en 4:3 sur du noir quand sa table est filmée en largeur",
      moments: [
        { at: 0.3, what: "deux petits mots manuscrits crème apparaissent en fondu de part et d'autre du milieu de sa table" },
        { at: 0.43, what: "dix photos tirées se posent d'un coup au centre, l'une sur l'autre, onze par seconde, sans bord ni ombre, chacune un peu tournée, sur un cliquetis sec" },
        { at: 1.8, what: "la pile tenue un temps s'efface par la lumière en quatre images, le sombre d'abord, le blanc d'une assiette en dernier" },
        { at: 2.03, what: "deux plans éclair de son lieu, saccadés, le second brûlé au blanc sauf son rouge, puis noir à gauche : les mots partent avec la coupe" },
        { at: 2.53, what: "écran partagé : son lieu à gauche, un geste sur ce qu'elle fait à droite, chacun à sa vitesse, qui coupent ensemble cinq fois ; puis la droite coupe seule, de plus près" },
        { at: 6.67, what: "sa plus belle pièce vue du dessus prend la moitié droite, puis tout le cadre une image après : une main en prend un morceau et sort du cadre" },
      ],
      camera: "mixte",
      grade: "moody",
      motion: "fait_main",
      music: "jazzy lo-fi beat, brushed drums, warm bass line, mellow keys",
      ending: "sa plus belle pièce vue du dessus, un geste qui en prend un morceau et sort du cadre, puis elle seule ; la musique coupée net, ni carte ni texte",
      why: "Le geste de poser ses photos sur la table raconte l'endroit avant de le montrer, puis le lieu et le geste côte à côte disent le savoir-faire sans un mot de trop.",
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
    // 15: written on its original's fiche (v2 of its skill): 92,9 BPM, horizontal 16:9 on black when her videos are, its
    // cells, windows, silhouettes, split screen, squares and loop, its teal and orange without grain (« Voyage » was
    // desaturated with grain, « pov » vertical, an indie electronic music).
    pitch: "Des fenêtres s'ouvrent sur tes plans pendant que deux étiquettes techniques restent fixes, comme un carnet de voyage.",
    needs: "10 à 14 vidéos de ton lieu, de ta rue ou de ton quartier, en largeur de préférence : un beau plan large pour ouvrir (il revient à la fin), quelqu'un debout au milieu, le même endroit le jour et la nuit, des plans larges et courts",
    files: [5, 14],
    pair: "technique",
    example: "P-fenetres-etiquettes",
    // Its music's tempo, measured on its original (docs/fiches/fenetres.md: its kicks and snares on its grid, 93 rounded).
    tempo: 92.9,
    finish: { name: "Teal et orange", hint: "ciels cyan, terres ocre, ombres un peu vertes, contrasté, saturé sans excès, sans grain ni coins sombres", contrast: 0.12, saturation: 0.08, shadows: "#0e1f24", highlights: "#f2d3a2", split: 0.3 },
    look: {
      name: "fenêtres et étiquettes",
      format: "pov",
      hook: { kind: "pov", what: "un beau plan large, deux petites étiquettes fixes à mi-hauteur, et le plan suivant qui prend l'image case par case" },
      text: {
        amount: "une ligne",
        composition: "deux petites étiquettes techniques en capitales blanches fines et condensées (un repère du lieu à gauche, ses coordonnées à droite), fixes à mi-hauteur à 10 % des bords, sans ombre, du début à la fin",
        case: "upper",
        weight: "regular",
        tracking: "normal",
      },
      layout: "une image 16:9 sur du noir (plein écran en vertical) : le plan suivant entre par une grille 3 × 3, des fenêtres qui sautent, une fenêtre derrière quelqu'un ; jour et nuit côte à côte puis en damier",
      moments: [
        { at: 0, what: "cinq plans coulent l'un dans l'autre : le suivant, qui joue déjà, prend les 3 × 3 cases de l'image une ou deux à la fois toutes les deux images, en serpentin depuis un coin" },
        { at: 2.47, what: "dans le creux de la musique, des fenêtres aux proportions de l'image s'ouvrent d'un coup sur le plan suivant et sautent, de plus en plus grandes et nombreuses ; la silhouette blanche de ce qui arrive, puis la coupe" },
        { at: 3.67, what: "la case du milieu s'ouvre derrière la personne du plan sur le plan suivant, en négatif puis en couleur, et prend la case du dessus" },
        { at: 4.4, what: "des silhouettes blanches ou crème de ce qui arrive, 2 à 4 images avant les coupes ; une coupe délavée de blanc ; le plan d'avant revient deux fois en éclair" },
        { at: 7.2, what: "le même endroit de jour glisse depuis la gauche sur le plan de nuit jusqu'au milieu, en écran partagé, puis le bloc du milieu échange ses moitiés en damier et clignote en négatif" },
        { at: 9.53, what: "un plan par temps : de petits carrés s'allument un par un sur d'autres plans à travers une coupe ; une personne détourée arrive sur le plan d'avant, puis son décor se pose autour par grands rectangles ; des éclats chauds et crème sur les coupes" },
        { at: 12.8, what: "le premier plan revient par fenêtres, figé sur sa première image : le Reel tourne en boucle" },
      ],
      camera: "à la main",
      grade: "natural",
      transitions: "effets",
      music: "lo-fi hip-hop beat, dusty kick and snare, warm pad, spoken film dialogue sample",
      ending: "le premier plan revient par fenêtres, figé sur sa première image, les étiquettes toujours là : la boucle",
      why: "Les étiquettes fixes donnent un air de carnet de voyage et situent le lieu, pendant que chaque coupe se fait par une fenêtre différente : on ne voit pas le temps passer, et la boucle fait revoir le Reel.",
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
    // 14: written again on its original's fiche (v2 of its skill): her front built piece by piece on black, then her name
    // pressed into a peach paper and inked letter by letter, its line under it; 113,2 BPM so that its reprise, its cut
    // and its end fall on whole beats of a music that starts on its first beat (its original: 120).
    pitch: "Ta devanture se construit morceau par morceau sur le noir, puis ton nom pressé dans un papier pêche s'encre lettre à lettre.",
    needs: "une vidéo fixe de ta devanture, de face, avec de la vie devant et ton nom visible",
    files: [1, 1],
    pair: "gaufre",
    example: "I-gaufre",
    tempo: 113.2,
    finish: { name: "Jour doux", hint: "lumière du jour douce, couleurs naturelles", contrast: 0.03, saturation: -0.05 },
    look: {
      name: "devanture puis titre gaufré",
      format: "collage",
      hook: { kind: "mystère", what: "un écran noir où son nom apparaît d'un coup, puis sa devanture qui se construit morceau par morceau" },
      text: {
        amount: "une ligne",
        composition: "son nom en serif très gras au centre d'un papier pêche, pressé en relief puis encré lettre à lettre, et dessous une ligne en petites capitales très espacées",
        weight: "black",
        tracking: "tight",
      },
      colors: ["#b43c01", "#f5cca4"],
      layout: "sa devanture qui se construit sur du noir, puis un papier pêche plein cadre où son nom est gaufré ; en bande 16:9 si sa vidéo est horizontale",
      moments: [
        { at: 0.03, what: "son nom, puis trois morceaux de sa devanture loin l'un de l'autre, lentement, sur le noir" },
        { at: 2.67, what: "une rafale de morceaux, puis les murs entre les rangées, de bas en haut" },
        { at: 5.27, what: "la rue, le haut et tout le reste sur la reprise : sa devanture entière, caméra fixe" },
        { at: 9, what: "le papier pêche : son nom pressé en relief, encré lettre à lettre, puis sa petite ligne" },
      ],
      camera: "fixe",
      motion: "fait_main",
      music: "warm acoustic bossa indie pop, nylon guitar, soft kick on every beat",
      ending: "son nom encré sur le papier, la musique coupée net",
      why: "On voit le lieu naître, puis la matière du papier fait artisanal et premium : on a envie de toucher l'écran.",
    },
  }),
  model({
    key: "mot-cle",
    name: "Mot clé en grand",
    // 15: written on its original's fiche (v1 of its skill, timed on her voice): her first two words slide in big from the
    // first image, each idea's keyword slides in under a small line of her words said one by one, a list two names at a
    // time each in its own font, a number and its three words, three frames between her ideas, a music that waits for her
    // first keyword and loses its bass mid-way.
    pitch: "Tu parles face caméra devant un fond uni, et le mot important de chaque phrase s'affiche en grand au-dessus de ta tête.",
    needs: "une vidéo de toi qui parles face caméra (20 à 30 s), assise devant un mur uni, téléphone posé, la tête vers le milieu de l'image ; si tu peux, la même prise d'un second téléphone",
    files: [1, 3],
    // Its hook, keywords and small words in a bold geometric (the original's Poppins-like), its number condensed (Anton,
    // brought by its skill): not the condensed Bebas Neue of « condensee-geometrique », which only fits its number.
    pair: "geometrique",
    example: "K-kinetic",
    finish: { name: "Studio", hint: "couleurs franches, contraste propre", contrast: 0.1, saturation: 0.08 },
    look: {
      name: "mot clé au-dessus de la tête",
      format: "raconte",
      voice: "quelqu'un parle",
      hook: { kind: "promesse", what: "ses deux premiers mots en grandes capitales grasses qui glissent de la gauche dès la première image, au-dessus de sa tête" },
      text: {
        amount: "plusieurs",
        composition: "au-dessus de sa tête : ses premiers mots puis le mot clé de chaque idée en capitales grasses glissant de la gauche, ses mots dits en petit au-dessus ; une liste deux noms à la fois, chacun dans sa police ; ses sous-titres sur sa poitrine",
        case: "upper",
        weight: "bold",
        subtitles: true,
      },
      layout: "elle assise face caméra devant un mur uni, plein cadre vertical (sa vidéo horizontale entière dans une bande 16:9 sur du noir), un autre cadre entre deux idées, les mots au-dessus de sa tête",
      moments: [
        { at: 0, what: "ses deux premiers mots glissent de la gauche, flous, rebondissent sur un souffle grave, tenus jusqu'à ce qu'elle dise la suite" },
        { at: 1.07, what: "ses mots s'écrivent un à un sur une petite ligne très espacée ; le mot clé glisse dessous sur son mot (1,73 s) et reste toute l'idée" },
        { at: 5.67, what: "coupe sur un autre cadre entre deux idées, rien au-dessus de sa tête jusqu'à la suivante" },
        { at: 7.1, what: "une liste deux noms à la fois, chacun dans sa police, le premier petit en haut, le second grand dessous, chacun sur son mot" },
        { at: 17.6, what: "un chiffre très condensé et ses trois mots empilés à sa droite, d'un coup, tenus 4 s" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "energique",
      music: "laid-back hip-hop beat at 108 BPM, deep sub bass, coming in after the hook",
      ending: "elle dit au revoir, plus rien au-dessus de sa tête, la musique coupée avec l'image",
      why: "Chaque idée a son mot en grand, chaque nom sa police : on retient ce qui est dit même sans le son, et la personne reste au centre.",
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
    key: "rallume",
    name: "La pièce qui se rallume",
    // Tristan's own idea, written as a design without an original (docs/fiches/rallume.md, v1 of its skill): her place
    // in the dark, what it has several of lit again one by one at its own light, the whole room at once on the downbeat
    // with her name like a sign, the life of her place, everything off at once so the Reel loops.
    pitch: "Ton lieu dans le noir, puis tes lampes, tes bouteilles ou tes tasses qui se rallument une à une, chacune à sa lumière, toute la pièce d'un coup avec ton nom qui s'allume comme une enseigne, et la vie de ton lieu.",
    needs: "6 à 12 vidéos de ton lieu le soir : un plan large de la salle avec ses lumières allumées (des suspensions, des lampes, des bougies) et ce qui s'y voit plusieurs fois, la caméra posée, puis des moments de la vie de ton lieu",
    files: [4, 12],
    pair: "editorial",
    example: null,
    // Its own design's tempo (no original to measure).
    tempo: 96,
    finish: { name: "Lumière du soir", hint: "chaud et doré, noirs profonds, un halo sur les lampes, sans grain ni coins sombres", contrast: 0.1, saturation: 0.06, warmth: 0.1, glow: 0.18, glow_color: "#FFB46A", shadows: "#0F0D14", highlights: "#F6DDB4", split: 0.15 },
    look: {
      name: "la pièce qui se rallume",
      format: "pov",
      hook: { kind: "mystère", what: "son lieu dans le noir, et ses lampes qui se rallument une à une, chacune avec un petit clic" },
      text: {
        amount: "une ligne",
        composition: "le nom du lieu allumé comme une enseigne, blanc chaud avec un halo, au-dessus de l'image (en plein écran dans la partie calme de la salle) ; une petite ligne en capitales espacées dessous",
        case: "normal",
        weight: "regular",
        tracking: "normal",
      },
      layout: "une image 16:9 sur du noir, son nom allumé au-dessus (plein écran si ses vidéos sont verticales) ; ses objets allumés un par un dans la salle assombrie, puis toute la salle",
      moments: [
        { at: 0, what: "la salle dans le noir, un cinquième de sa lumière ; ce qu'elle a plusieurs fois se rallume pièce par pièce, de plus en plus vite, chacune à sa lumière avec un halo chaud et un clic, la musique étouffée" },
        { at: 2.5, what: "toute la salle d'un coup sur le temps, deux images plus vives ; la musique s'ouvre et le nom s'allume comme un néon qui prend" },
        { at: 5, what: "la vie du lieu en plans courts coupés sur le temps, d'un, un puis deux temps" },
        { at: 12.5, what: "un dernier plan large de la salle : tout s'éteint d'un coup avec un clic, le nom reste allumé dans le noir, la musique de nouveau étouffée" },
      ],
      camera: "mixte",
      grade: "natural",
      motion: "chaleureux",
      music: "warm late-night soul groove, Rhodes chords, soft kick on every beat",
      ending: "tout s'éteint d'un coup, son nom reste allumé dans le noir : la fin ressemble au début et le Reel reboucle",
      why: "Le noir crée l'attente, chaque lumière qui revient est une petite récompense, et toute la salle qui s'allume avec son nom donne envie d'y entrer ; la boucle fait revoir le Reel.",
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
    // 15: written again on its original's fiche (v2 of its skill): its music stopped dead and back as she lands, its
    // beep, its switch flipped in one image, its poster at once, her in front, its format.
    pitch: "Tu actionnes un grand interrupteur dessiné sur ton mur, et ton logo s'allume.",
    needs: "une vidéo de toi qui sautes (ou tends le bras) pour toucher un point haut d'un mur clair, filmée fixe en vertical, et ton logo",
    files: [1, 2],
    pair: "grotesque",
    // Its reference composition added a cursor that clicks and a tilted « C'EST OUVERT » the original does not have: its
    // skill's code is its reference now.
    example: null,
    // Its first piece's grid, 143,7 BPM counted one beat in two (the engine wants 60 to 140; the fiche, effects 5 and 6).
    tempo: 71.85,
    finish: { name: "Clair", hint: "lumière douce, contraste doux, sans grain ni coins sombres", contrast: 0.04, warmth: 0.04 },
    look: {
      name: "interrupteur et affiche",
      format: "autre",
      hook: { kind: "geste", what: "un grand interrupteur de téléphone dessiné à plat, éteint, en haut d'un mur clair, hors de portée, et quelqu'un qui lève la main vers lui" },
      text: {
        amount: "plusieurs",
        composition: "une affiche qui s'allume d'un coup sur le mur sous l'interrupteur : son logo, son titre en grand souligné à la main, une petite ligne en capitales espacées entre deux traits, un détail minuscule, une étincelle",
        weight: "bold",
      },
      layout: "un seul plan fixe en plein cadre vertical : un mur clair, l'interrupteur dessiné en haut, l'affiche dessous, la personne devant les deux",
      moments: [
        { at: 0, what: "le mur vide, l'interrupteur éteint en haut (piste grise, pastille blanche à gauche)" },
        { at: 2.29, what: "elle lève la main sans l'atteindre : la musique s'arrête net, un bip court dans le silence à 3,06 s, elle s'accroupit et saute" },
        { at: 4.1, what: "au sommet de son saut, ses doigts touchent l'interrupteur : il bascule d'un coup, en une image, et l'affiche est là sur le mur, elle devant" },
        { at: 4.41, what: "elle retombe et la musique repart avec sa basse ; elle s'en va, le mur garde l'interrupteur allumé et l'affiche jusqu'à la fin" },
      ],
      sounds: [{ at: 3.06, what: "un bip court et aigu, seul dans le silence" }],
      camera: "fixe",
      motion: "epure",
      music: "choppy melodic hip-hop beat with a heavy 808 bass, about 72 BPM",
      ending: "le mur avec l'interrupteur allumé et l'affiche, sans elle, jusqu'à la fin du son",
      why: "Le gag tient en une seconde : elle n'y arrive pas, saute, et tout s'allume d'un coup avec la musique qui repart ; on finit sur l'affiche.",
    },
  }),
  model({
    key: "interface",
    name: "Interface minimaliste",
    // 15: written on its original's fiche (v2 of its skill): 110,5 BPM (it played at 100), its moments on its images
    // with two holds lengthened for a phone, « S'abonner » (Tristan's word), its pale ground as it is, no grain.
    pitch: "Des mots qui sortent du flou sur fond clair, une liste qui défile, ta phrase tapée, puis ton profil et un curseur qui clique « S'abonner ».",
    needs: "ta photo de profil ou ton logo (ou 2 à 3 s de toi qui regardes l'objectif), ton compte Instagram, ce que tu fais en trois mots et ta promesse en une phrase",
    files: [0, 2],
    pair: "grotesque",
    example: "AB-interface",
    // Its music's tempo, measured on its original (docs/fiches/interface.md: its entrances and its click on its grid).
    tempo: 110.5,
    finish: { name: "Net", hint: "son fond clair uni tel quel, sans grain ni coins sombres" },
    look: {
      name: "interface minimaliste",
      format: "autre",
      hook: { kind: "promesse", what: "trois mots qui sortent du flou lettre à lettre au centre d'un fond gris-bleu très clair, le dernier en serif italique" },
      text: {
        amount: "plusieurs",
        composition: "des mots petits au centre d'un grand vide clair, une grotesque grasse et un mot en serif italique ; une étiquette minuscule en capitales espacées sur une liste qui défile ; une phrase tapée ; une carte de profil",
        weight: "bold",
        tracking: "tight",
        stress: "serif",
      },
      colors: ["#1051c4", "#222853"],
      layout: "pur motion design sur un fond gris-bleu clair uni, sans coupe : chaque élément devient le suivant (le dernier mot l'étiquette, la phrase avalée par une icône qui s'ouvre en carte de profil)",
      moments: [
        { at: 0.13, what: "trois mots sortent du flou lettre à lettre au centre, une lettre par image, petits, le dernier en serif italique" },
        { at: 1.47, what: "les premiers partent dans le flou ; le dernier monte, rapetisse de moitié, grise, puis se change lettre à lettre en une petite étiquette en capitales espacées ; une liste de trois mots monte d'en bas et défile sur la ligne du milieu, un cran par temps, celui du milieu net et noir, ses voisins pâles et flous" },
        { at: 3.17, what: "le dernier mot de la liste souligné d'un trait bleu roi à indigo qui s'effile, tracé de gauche à droite en un tiers de seconde" },
        { at: 4.03, what: "la liste part vers le haut dans le flou ; une annonce de deux lignes monte mot à mot, ses deux derniers mots en italique ; puis elle s'efface lettre à lettre depuis la gauche" },
        { at: 6.83, what: "un curseur bleu qui ne clignote pas tape une phrase, 38 lettres par seconde, chaque lettre floue une image ; ses derniers mots en italique" },
        { at: 8.87, what: "l'icône d'Instagram se pose sur le dernier mot, glisse au centre et avale la phrase ; elle s'ouvre en carte de profil blanche aux coins arrondis : son compte, sa photo ronde en noir et blanc, son nom, son métier en italique gris, sa bio, « S'abonner » qui passe au bleu, « Message »" },
        { at: 10.63, what: "toute la carte grossit 1,5 fois vers « S'abonner », le reste de la carte part ; une flèche noire arrive d'en bas à droite en arc et clique, sans anneau : le bleu s'éteint, « Abonné(e) » monte" },
        { at: 11.8, what: "la photo et le bouton se replient en pastille blanche avec le compte et une coche ; puis la pastille s'efface, la photo devient le @ du compte, en dégradé bleu, « À SUIVRE » au-dessus lettre à lettre" },
      ],
      camera: "fixe",
      motion: "epure",
      music: "light minimal electronic, soft plucks, opening up with a bright held note",
      ending: "son compte au centre en dégradé bleu, « À SUIVRE » au-dessus en minuscules capitales grises, tenu jusqu'au bout",
      why: "Propre comme une appli : chaque élément devient le suivant sans une coupe, on comprend ce que fait la personne, et le Reel finit sur le geste qu'on attend, la suivre.",
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
    // 15: written again on its original's fiche (v2 of its skill): its 16:9 frame and its grid's proportions, its loops
    // at a hand's pace chained one after the other, its sentence held 5 s, its light dosed, no grain.
    pitch: "Un plan calme sous une grille de lettres, où des boucles tracées à la main entourent les mots cachés un à un.",
    needs: "une vidéo calme et fixe de ton lieu ou de toi au travail, d'environ 20 secondes, à l'horizontale de préférence",
    files: [1, 2],
    pair: "grotesque",
    example: "A-mots-meles",
    // Its original has no sound: a calm music under it, its loops on the hand, never on a beat.
    tempo: 80,
    // Its code darkens her shot to its own light: here only its faded colours and its barely lifted blacks.
    finish: { name: "Doux", hint: "couleurs passées, noirs à peine levés, contraste doux, sans grain ni coins sombres", contrast: -0.03, saturation: -0.2, fade: 0.05 },
    look: {
      name: "mots mêlés",
      format: "message",
      hook: { kind: "mystère", what: "une grille aérée de fines lettres blanches posée sur une scène calme, une boucle tracée à la main qui commence à entourer un mot" },
      text: {
        amount: "un message tenu",
        composition: "une grille de fines capitales blanches sur toute l'image (16 × 10 en 16:9), très aérée, les mots de la phrase cachés dans l'ordre et entourés un à un d'une boucle blanche fine tracée à la main",
        case: "upper",
        weight: "regular",
        tracking: "wide",
        stress: "marker",
        stroke: "thin",
      },
      layout: "un seul plan fixe en 16:9 sur du noir comme l'original (plein cadre en vertical), une grille de lettres posée sur toute l'image",
      moments: [
        { at: 0, what: "la grille de lettres sur toute l'image, le plan calme et un peu assombri dessous, téléphone posé" },
        { at: 0.13, what: "une boucle blanche tracée à la main entoure le premier mot, au-dessus de sa première lettre, à l'allure d'une main (2,6 s), puis chaque mot de la phrase dès que la précédente se ferme ; un mot sur deux rangées en escalier, un en diagonale" },
        { at: 13.3, what: "toute la phrase entourée, tenue plus de cinq secondes, rien d'autre ne bouge que la personne" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "fait_main",
      music: "calm warm acoustic guitar and soft keys, no marked drums, slow and airy",
      ending: "la grille avec toute la phrase entourée, tenue plus de cinq secondes",
      why: "On joue avec le Reel : chercher les mots retient l'attention, et la phrase trouvée reste en tête.",
    },
  }),
  model({
    key: "aplat",
    name: "Toi sur un aplat de couleur",
    // 15: written again on its original's fiche (v2 of its skill): 123 BPM, a pure red (or her vivid colour), her shot
    // rebuilt from the nearest to the farthest, the next shot's still pieces one an eighth, a frame closing at a constant
    // speed, the frozen world in a new look on each note, no text of its own; 4:3 on black when her videos are horizontal.
    pitch: "Ta silhouette détourée qui marche sur un grand aplat de couleur vive, puis tes plans encadrés de la même couleur.",
    needs: "une vidéo de quelqu'un qui marche, de dos ou de profil, un plan large de ton lieu avec plusieurs choses au premier plan, et quelqu'un devant un fond qui fait un geste",
    files: [3, 10],
    pair: "affiche",
    example: "aplat",
    // Its music measured on its original (docs/fiches/aplat.md): 122,99 BPM, a melody without drums in phrases of a bar.
    tempo: 123,
    finish: { name: "Couleurs franches", hint: "contraste et couleurs poussés, sans grain ni coins sombres", contrast: 0.14, saturation: 0.14 },
    look: {
      name: "personne sur aplat",
      format: "collage",
      hook: { kind: "geste", what: "une personne qui marche, détourée sur un aplat rouge pur, blanche et lumineuse trois images, puis à ses couleurs avec son ombre" },
      text: { amount: "aucun", composition: "aucun texte" },
      colors: ["#ff0000"],
      layout: "en 4:3 sur du noir quand ses vidéos sont horizontales : la silhouette sur l'aplat, son plan qui revient autour d'elle, le plan suivant posé morceau par morceau, un cadre rouge qui se referme",
      moments: [
        { at: 0, what: "sa silhouette blanche dans un halo pendant trois images sur un aplat rouge pur, puis à ses couleurs, seule avec son ombre" },
        { at: 0.5, what: "son plan revient autour d'elle du plus près au plus loin : le sol sous ses pieds, le chemin, puis tout le sol en blanc, le ciel en blanc, le plan entier" },
        { at: 2.8, what: "le plan suivant se pose dessus morceau par morceau, figé, un par croche, chacun blanc une image, puis il arrive entier, surexposé deux images" },
        { at: 4.5, what: "un cadre rouge se referme sur lui par les quatre côtés à vitesse constante, sans réduire l'image" },
        { at: 5.9, what: "quelqu'un devant un fond : le décor se fige derrière lui et change de look sur chaque note pendant qu'il bouge" },
        { at: 8.3, what: "l'aplat rouge plein cadre jusqu'à la fin, sur lequel le Reel reboucle" },
      ],
      camera: "à la main",
      motion: "energique",
      music: "bright synth melody in one-bar phrases, held notes, gliding runs, no drums",
      ending: "l'aplat rouge plein cadre, sur lequel le Reel reboucle",
      why: "La silhouette seule sur la couleur arrête le pouce, son plan qui se reconstruit et le décor qui change de look retiennent, et la couleur qui revient signe le Reel.",
    },
  }),
  model({
    key: "detourages",
    // Renamed on its original's fiche (Tristan: « ok »): no cut-out pops in it; a window opens on the place, the name
    // blinks letter by letter behind its scenery, then a burst on the beat.
    // 15: written again on its fiche (v2 of its skill): 140 BPM, its slit, its name flashing letter by letter behind her
    // sky, its burst on the dotted rhythm with its two sweeps, its rounded window on black, a soft film grade.
    name: "Ton nom qui clignote",
    pitch: "Une fenêtre s'ouvre sur ton lieu ou ton paysage, ton nom s'y allume lettre par lettre derrière le décor, puis une rafale de plans sur le rythme.",
    needs: "un plan large et fixe de ton lieu, ou d'un paysage quand ça a du sens (ta plage, ta vallée), avec du ciel au-dessus, et 10 à 20 plans courts qui bougent (des gestes, des matières, ta rue)",
    files: [6, 16],
    // Its name in very bold, round and wide capitals (the original's, Montserrat ExtraBold-like): the new pair below;
    // until it exists, « geante-script » (Archivo Black) is the nearest.
    pair: "ronde-large",
    // Its reference composition was the v1's (a print on paper, a cut-out, a marker word): none now, its skill's code is it.
    example: null,
    // Its music measured on its original (docs/fiches/detourages.md): 140,3 BPM, six bars of 1,711 s in a row.
    tempo: 140,
    finish: { name: "Film doux", hint: "blancs crème jamais purs, noirs à peine levés, couleurs un peu éteintes, sans grain ni coins sombres", contrast: -0.03, saturation: -0.1, shadows: "#1c1d17", highlights: "#d1cfc3", split: 0.3 },
    look: {
      name: "nom qui clignote",
      format: "pov",
      hook: { kind: "mystère", what: "une fente noire qui s'ouvre lentement sur un plan large et fixe, puis un nom en très grandes capitales blanches qui s'allume lettre par lettre derrière le décor" },
      text: {
        amount: "une ligne",
        composition: "un seul mot en capitales blanches très grasses, rondes et larges, sur près de 90 % de la largeur dans le ciel du premier plan, derrière ce qui s'y dresse, chaque lettre qui clignote, s'éteint puis tient",
        case: "upper",
        weight: "black",
        tracking: "normal",
      },
      layout: "une fenêtre un peu plus large que haute aux coins arrondis sur du noir quand ses vidéos sont horizontales, sinon plein cadre aux coins arrondis ; ses plans en coupes franches",
      moments: [
        { at: 0, what: "noir, puis une fente verticale au milieu qui s'élargit à vitesse constante jusqu'à toute la largeur, sur un plan large et fixe" },
        { at: 3.6, what: "le nom s'allume lettre par lettre dans le désordre, de plus en plus vite : chacune clignote, s'éteint puis tient, derrière le décor" },
        { at: 6.2, what: "le drop : une rafale de plans courts coupés sur le rythme pointé de la chanson, des gens qui font un geste, des matières de près, des vues d'en haut" },
        { at: 9.7, what: "un balayage très rapide, tout flou, puis la rafale reprend" },
        { at: 13.1, what: "un deuxième balayage, de côté, puis trois plans vus d'en haut" },
        { at: 14.8, what: "un dernier plan tenu, quelqu'un de dos devant son lieu, les bras levés ; la basse s'arrête puis repart" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "film",
      motion: "energique",
      music: "indie electro song, a soft drumless intro opening up, then a dotted driving beat",
      ending: "un dernier plan tenu, quelqu'un de dos les bras levés, coupé net sur la mesure : le Reel reboucle sur la fente noire",
      why: "La fenêtre qui s'ouvre et le nom qui clignote derrière le décor intriguent, puis la rafale sur le rythme donne de l'élan et envie d'y aller.",
    },
  }),
  model({
    key: "createur",
    name: "Face caméra et références",
    // 15: written on its original's fiche (v1 of its skill, timed on her voice): her images above her, in the top half
    // or full frame on the name she says, never beside her nor in a window behind her; her first phrase on bands; no
    // music (her voice alone); her logo on her name with a chime.
    pitch: "Tu parles face caméra, et ce dont tu parles apparaît au-dessus de toi, en moitié d'écran ou plein cadre au moment où tu le nommes, avec tes premiers mots en bandeaux.",
    needs: "une vidéo de toi qui parles face caméra, avec de la place au-dessus de ta tête, et 3 à 8 photos ou vidéos de ce dont tu parles (un objet sur un fond simple se détoure mieux), ton logo",
    files: [2, 10],
    // Its first phrase in a bold condensed grotesque on black bands, its small subtitles in a semi-bold grotesque.
    pair: "createur",
    example: "createur",
    tempo: 90,
    // No common grade (its fiche: the images it shows stay as they are); its skill lays none either.
    finish: { name: "Net", hint: "image propre, ses images telles quelles", contrast: 0 },
    look: {
      name: "face caméra et références",
      format: "raconte",
      voice: "quelqu'un parle",
      hook: { kind: "promesse", what: "sa première phrase sur des bandeaux noirs, chaque mot qui passe du gris au blanc quand il est dit, ce dont elle parle au-dessus de sa tête" },
      text: {
        amount: "plusieurs",
        composition: "sa première phrase en grasses condensées blanches sur des bandeaux noirs, mot à mot ; puis de petits sous-titres blancs sobres, une phrase à la fois, au milieu de l'image ; son nom sur une carte blanche quand elle le dit",
        weight: "bold",
        subtitles: true,
      },
      layout: "elle face caméra plein cadre ; ce dont elle parle dans la moitié du haut, détouré au-dessus de sa tête, plein cadre sur chaque nom cité, ou en mur de vignettes derrière elle",
      moments: [
        { at: 0, what: "sa première phrase sur des bandeaux noirs, mot à mot ; ce dont elle parle détouré sur son mur au-dessus de sa tête" },
        { at: 4.03, what: "écran partagé sur le premier mot de l'idée suivante : l'image en haut, elle en bas, les sous-titres sur la ligne de partage" },
        { at: 6.87, what: "une image plein cadre pour chaque nom qu'elle cite, coupée sur son mot" },
        { at: 12.07, what: "un autre cadre ; son logo surgit du milieu sur une carte blanche avec un carillon quand elle dit son nom" },
        { at: 23.8, what: "un mur de vignettes glisse des deux bords derrière elle, détourée devant" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "epure",
      music: "none (her voice alone, a chime under her logo)",
      ending: "elle seule, sa dernière phrase",
      why: "On voit ce qui est dit au moment où c'est dit : chaque nom a son image, la personne reste au centre.",
    },
  }),
  model({
    key: "silhouette",
    // Renamed on its original's fiche (Tristan: « ok »): a presentation, a word inside her head, her name behind her.
    // Written again on its fiche (v2 of its skill): its opening as a layout program and its negative, her profile in one
    // midnight tone with « Je suis » in it, her name typed behind her head, the letter that becomes an eye, the almond on
    // the drop, her trades on the hits, her name receding, her logo on the blue; 84,5 BPM, its break, its last hit.
    name: "Présente-toi",
    pitch: "Ton profil en silhouette d'un seul ton, un mot dans ta tête, puis ton nom qui s'écrit derrière toi et ce que tu fais qui défile.",
    needs: "une vidéo de toi de profil devant un fond clair, téléphone posé (5 s : tu baisses la tête puis tu la relèves), ton nom, ton métier en un mot et 3 à 5 choses que tu fais",
    files: [1, 4],
    pair: "grotesque",
    // Its old reference composition flickered a word letter by letter (nothing flickers in the original): the skill's
    // code is its reference now.
    example: null,
    // Its fiche's tempo (84,5 BPM, its bars on 1,06 · 3,90 · 6,74 · 9,58 s; house-measures.ts has no bpm for it).
    tempo: 84.5,
    finish: { name: "Aplats", hint: "deux aplats exacts, sans grain ni coins sombres", contrast: 0 },
    look: {
      name: "présente-toi",
      format: "autre",
      hook: { kind: "geste", what: "sur un bleu nuit, une boîte de texte de logiciel de mise en page où son premier mot se tape, puis tout passe en négatif d'un coup" },
      text: {
        amount: "plusieurs",
        composition: "une grotesque demi-grasse au milieu : son premier mot tapé qui grandit, un mot blanc dans sa silhouette, son nom tapé derrière sa tête (prénom en romain, nom en gras), ce qu'elle fait en gras qui change sur les coups",
        case: "normal",
        weight: "bold",
        tracking: "normal",
      },
      colors: ["#0d0d1b", "#f3f4f9", "#d99868"],
      layout: "deux aplats, un bleu nuit et un pâle froid ; sa silhouette de profil d'un seul bleu nuit en bas du cadre, coupée par le bas ; les mots au milieu ; un œil dessiné qui s'ouvre sur le pâle",
      moments: [
        { at: 0, what: "sur un bleu nuit, une boîte de texte de logiciel (repères en tirets à travers le cadre, cotes en px qui défilent) ; son premier mot se tape, une lettre seule puis une rafale, un clic par lettre, et grandit de moitié avec une traîne pêche ; une main en points salue à côté" },
        { at: 0.47, what: "tout passe en négatif en une image : fond pâle, mot à l'encre, repères gris clair" },
        { at: 1.07, what: "coupe sur le premier temps : sa silhouette de profil d'un seul bleu nuit sur le pâle, « Je suis » en blanc dans sa tête, qui s'efface quand elle baisse la tête ; son nom se tape derrière sa tête, posé sur ses cheveux, son nom de famille s'en va" },
        { at: 2.67, what: "son prénom se réduit à une lettre ronde qui grossit avec sa traîne et devient l'o de « Votre » ; ses lettres rebondissent autour ; l'o se remplit de pêche, une pupille y grandit, et l'œil monte pendant le break de la musique" },
        { at: 3.9, what: "sur le drop, des paupières bleu nuit se ferment sur l'image en amande ; l'œil se plisse, sa pupille devient une fente de chat, il s'ouvre grand, son métier n'apparaît que dans l'iris, puis l'œil ouvert devient le fond pâle" },
        { at: 5.47, what: "son métier fixe, ce qu'elle fait en gras à côté qui change sur les coups de plus en plus vite, un trait ondulé tracé dessous puis repris, une pastille pêche puis le pictogramme de son métier au bout du mot" },
        { at: 7.8, what: "son nom seul, petit, au milieu du pâle, qui recule" },
        { at: 9.57, what: "coupe sur la dernière mesure : son logo blanc, petit, sur le bleu nuit, puis le bleu seul pendant que la musique s'éteint" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      motion: "epure",
      music: "slow half-time electronic beat, deep held bass, a short break then the drop",
      ending: "son logo blanc sur le bleu nuit, la musique arrêtée sur son dernier coup qui résonne",
      why: "Une présentation en motion design : en onze secondes on retient son profil, son nom et son métier, et l'œil qui s'ouvre sur la suite surprend.",
    },
  }),
  model({
    key: "vision",
    name: "Vision machine",
    // Written on its original's fiche (v1 of its skill, docs/fiches/vision.md): one fixed shot through some ten machine
    // looks taking turns in a strobe of clean cuts; its frames blue or dotted (not the people tinted), characters and dots
    // (not a line drawing), its labels dropping letters, its place built and erased tile by tile; its beep at 155 BPM.
    pitch: "Ton lieu vu par une machine : chaque passant dans un cadre qui clignote en bleu, reliés par des fils, puis des points, des caractères et ton lieu qui s'efface dalle par dalle.",
    needs: "un seul plan fixe de 8 à 10 s de ton lieu filmé de haut (une mezzanine, un escalier), téléphone posé : quelqu'un qui ne bouge pas au milieu et des gens qui passent autour, un sol à carreaux ou à dalles",
    files: [1, 3],
    pair: "technique",
    // Its old reference composition (people tinted blue, a decoding title, a line drawing) is what its fiche corrects:
    // the skill's code is its reference now.
    example: null,
    // Its fiche's tempo, a beat every two of its beeps (155 BPM; house-measures.ts has no bpm for it).
    tempo: 77.5,
    finish: { name: "Tel que filmé", hint: "sans étalonnage, sans grain ni coins sombres", contrast: 0 },
    look: {
      name: "vision machine",
      format: "autre",
      hook: { kind: "mystère", what: "la personne immobile seule sur blanc dans des cadres qui clignotent entre bleu et noir à points, puis son lieu qui se construit dalle par dalle autour d'elle" },
      text: {
        amount: "aucun",
        composition: "aucun titre : de toutes petites étiquettes en capitales pixel sur des onglets bleu nuit au-dessus des cadres, qui perdent leurs lettres à chaque image, et des codes binaires, en décor",
        case: "upper",
        weight: "regular",
        tracking: "normal",
      },
      colors: ["#142754", "#aabcdd", "#07070e"],
      layout: "son plan plein cadre vu par une dizaine de regards de machine : fonds blancs et noirs, cadres bleus ou à points sur chaque passant, profondeur grise, réseau, graphe, caractères",
      moments: [
        { at: 0, what: "la personne immobile et ce sur quoi elle est, seuls sur blanc dans leurs cadres, qui clignotent : bleu, noir à points, bleu, des noirs entre" },
        { at: 0.47, what: "son lieu se construit dalle par dalle autour d'elle, la moitié d'un coup, les autres en fondu depuis le blanc, le fond laissé blanc" },
        { at: 1.2, what: "un premier clignotement de coupes franches d'une à huit images : un cadre sur chaque passant, bleu en deux tons ou noir à points, une étiquette qui perd ses lettres ; la profondeur en gris ; le réseau des passants reliés par des fils ; les passants en points ; la personne en caractères ; des noirs" },
        { at: 3.63, what: "le graphe seul sur blanc, un point par passant relié aux autres par des fils, des codes binaires ; puis les passants dans leurs cadres dessus" },
        { at: 4.53, what: "un second clignotement plus serré, une passe toutes les deux images quand le bip double ; toute la place en caractères clairs sur noir" },
        { at: 7.23, what: "son lieu s'efface dalle par dalle, du fond vers la personne immobile, jusqu'à elle seule" },
        { at: 8.03, what: "la personne en caractères clairs sur noir, puis le noir" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      motion: "energique",
      music: "a held high beep retriggered on every beat, 155 BPM, a deep rumble, no drums",
      ending: "son lieu effacé dalle par dalle jusqu'à la personne immobile, en caractères clairs sur noir, puis le noir",
      why: "Son lieu ordinaire vu comme par une machine : le stroboscope de regards intrigue, chaque passe montre autre chose, et la personne immobile au milieu tient l'œil.",
    },
  }),
  model({
    key: "court-metrage",
    name: "Court métrage",
    // Written on its original's fiche (v1 of its skill, docs/fiches/court-metrage.md): a short travel film projected as on
    // an old projector, its picture with rounded corners on a soft black, opened from a slit, its title card in lemon
    // yellow, its film burns, the film slipping in the gate in its middle, a shot a bar, its fade to black.
    pitch: "Ta journée en court métrage projeté : l'image s'ouvre depuis une fente, le titre de ton film en jaune, une brûlure de pellicule, un plan par mesure, la pellicule qui saute au milieu, puis un fondu au noir.",
    needs: "5 à 10 vidéos de ta journée à l'horizontale, dans une belle lumière (le matin, l'heure dorée, un contre-jour) : un intérieur calme pour ouvrir, ta rue, ton trajet, tes gestes, une vue calme pour finir",
    files: [4, 10],
    pair: "generique",
    // Its skill's code is its reference.
    example: null,
    // Its cuts' grid (docs/fiches/court-metrage.md): seven cuts within an image at 85,5 (its music's onsets say 85,3).
    tempo: 85.5,
    finish: { name: "Pellicule dorée", hint: "chaud et doux, noirs relevés, hautes lumières retenues, sans grain ni coins sombres", warmth: 0.05, fade: 0.08, contrast: -0.03 },
    look: {
      name: "court métrage projeté",
      format: "pov",
      hook: { kind: "promesse", what: "l'image qui s'ouvre depuis une fente au milieu, dans une pellicule aux coins arrondis, et le titre du film en jaune qui s'y pose d'un coup" },
      text: {
        amount: "une ligne",
        composition: "un générique sur le premier plan : un petit mot en capitales très espacées en haut, le titre en grandes capitales serif sur deux lignes serrées au milieu, une signature en petit italique en bas, en jaune citron",
        case: "upper",
        weight: "bold",
        tracking: "tight",
      },
      colors: ["#f2ea4a"],
      layout: "chaque plan dans une image de pellicule 1,94:1 aux coins arrondis sur un noir doux, au milieu du cadre quand ses vidéos sont horizontales",
      moments: [
        { at: 0, what: "le noir avec un déclic, puis l'image qui s'ouvre depuis une fente au milieu, deux bandes noires qui s'écartent à vitesse égale en 2,3 s, le bruit d'un projecteur" },
        { at: 2.57, what: "sur le temps, le titre du film posé d'un coup en jaune : un petit mot espacé en haut, le titre en grandes capitales serif au milieu, une signature en italique en bas, avec un déclic" },
        { at: 3.83, what: "une brûlure de pellicule entre par la gauche (rouge-orangé, orange, ambre, puis jaune pâle) et blanchit l'image sur la coupe ; la musique entre" },
        { at: 4, what: "un plan par mesure, coupé sur chaque accord, dans une lumière dorée : la rue, le trajet, les gestes" },
        { at: 15.03, what: "la pellicule saute dans le projecteur : une brûlure, l'image qui remonte par à-coups pendant six images, ses lignes noires et ses perforations qui passent, une image crème brûlée, une dernière brûlure" },
        { at: 20.87, what: "un dernier plan calme et large, en fondu au noir avec la musique" },
      ],
      sounds: [
        { at: 0.13, what: "film projector switch click, on the black" },
        { at: 0.2, what: "old film projector running, under the opening slit" },
        { at: 2.54, what: "film projector click, as the title lands" },
        { at: 14.95, what: "film reel flutter, as the film slips in the gate" },
      ],
      camera: "mixte",
      transitions: "effets",
      grade: "film",
      motion: "epure",
      music: "lo-fi felt piano and pads, soft kick, round bass, off-beat shaker, 85 BPM",
      ending: "un dernier plan calme et large qui s'éteint en fondu au noir avec la musique",
      why: "On ouvre un film plutôt qu'une vidéo : la fente qui s'ouvre, le titre et la brûlure promettent une histoire, la pellicule qui saute relance au milieu, et la lumière dorée donne envie d'y être.",
    },
  }),
  model({
    key: "titre-cinema",
    name: "Titre de film signé",
    // Written on its original's fiche (v1 of its skill, docs/fiches/titre-cinema.md): a film's opening title, a word in
    // very heavy square white capitals dead centre over a still shot at dusk, signed under its end in a roman serif, the
    // person passing in front of the signature; its intro without its bass, the beat dropping on the cut; then still
    // shots of someone alone from behind, a bar or two each; its 10:9 window on black; no grain nor dark corners.
    pitch: "Le titre de ton film en grandes capitales blanches au-dessus de toi dans ton premier plan, signé de ton nom en petit (« par Léa »), toi qui passes devant ta signature, puis tes plans de cinéma coupés sur la musique qui démarre.",
    needs: "un plan large et fixe au crépuscule (ton lieu, ta rue ou un paysage, du ciel en haut) où tu marches ou te tiens, puis 3 à 7 plans fixes : quelqu'un seul de dos face à quelque chose de beau, des gens ensemble, quelqu'un qui s'en va au soleil couchant",
    files: [3, 8],
    pair: "generique-signe",
    // Its skill's code is its reference (no composition was written before it).
    example: null,
    // Measured on its original (docs/fiches/titre-cinema.md): a bar every 1,932 s, eight snares on the grid within 12 ms.
    tempo: 124.2,
    finish: { name: "Ciné du soir", hint: "ombres sarcelle, hautes lumières crème, couleurs riches, sans grain ni coins sombres", contrast: 0.1, saturation: 0.06, warmth: 0.04, shadows: "#071216", highlights: "#E8D9AE", split: 0.3 },
    look: {
      name: "titre de film signé",
      format: "pov",
      hook: { kind: "mystère", what: "un plan large et fixe au crépuscule, un mot en très grandes capitales blanches au milieu, signé dessous en petit serif, et quelqu'un qui avance et passe devant la signature" },
      text: {
        amount: "une ligne",
        composition: "un mot en capitales carrées très grasses, blanc, au milieu du premier plan sur 62 % de la largeur ; sous sa fin, une signature en serif romain (« par » et un prénom), derrière la personne",
        case: "upper",
        weight: "black",
        tracking: "normal",
        shadow: "none",
      },
      layout: "une fenêtre presque carrée (10:9) sur du noir quand ses vidéos sont horizontales, sinon plein cadre ; le titre sur le premier plan seulement",
      moments: [
        { at: 0, what: "un plan large et fixe au crépuscule, quelqu'un petit au milieu en bas qui avance lentement en levant les yeux ; le titre et sa signature là dès la première image, immobiles, la musique sans basse" },
        { at: 0.4, what: "sa tête passe devant la signature, de plus en plus, jamais devant le titre" },
        { at: 6.1, what: "la coupe emporte le titre et la basse tombe : un plan fixe de quelqu'un seul de dos devant ce qui brille (un manège illuminé), une mesure" },
        { at: 8.1, what: "quelqu'un de dos face à la mer au crépuscule, une mesure, puis de dos devant un aquarium immense, la main tendue, deux mesures" },
        { at: 13.83, what: "des gens ensemble (des passagers d'un bateau au soleil), puis une silhouette qui marche au soleil couchant, coupée net" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      grade: "natural",
      motion: "epure",
      music: "dreamy indie pop, swaying triplet feel, half-time drums, warm bass",
      ending: "une silhouette qui marche au soleil couchant, coupée net avec la musique ; ni carte, ni logo",
      why: "Le titre signé fait générique de film dès la première image, la personne qui passe devant sa signature lui donne de la profondeur, et la basse qui tombe sur la coupe lance des plans contemplatifs qu'on regarde jusqu'au bout.",
    },
  }),
  model({
    key: "celui-la",
    name: "Celui-là, celui-là…",
    // Tristan's model of 5 November (a ceramist's Reel and a second one on the same template; its skill v1,
    // docs/fiches/celui-la.md): her products one a beat, the same playful word popping on each at a new place, her
    // stretched hail and hesitation typed letter by letter, its music shaped as the original's voice.
    pitch: "Tes produits un par un sur le rythme, et sur chacun le même petit mot qui tombe chaque fois ailleurs (« Celui-là »), puis une hésitation… et le dernier.",
    needs: "une photo ou une courte vidéo de chacun de tes produits (cinq au moins, posés au même endroit si tu peux), ton présentoir vide et toute ta série réunie",
    files: [5, 16],
    pair: "editorial",
    // Its skill's code is its reference.
    example: null,
    // The original's voice chants on a steady pulse, a « this » a beat (its fiche).
    tempo: 96.5,
    finish: { name: "Naturel", hint: "lumière du jour douce, couleurs vraies, contraste doux, sans grain ni coins sombres", contrast: 0.03, warmth: 0.03 },
    look: {
      name: "un mot sur chaque produit",
      format: "autre",
      hook: { kind: "mystère", what: "son présentoir encore vide et un appel étiré tapé lettre à lettre, puis un mot qui l'arrête, trois fois, chaque fois ailleurs dans l'image" },
      text: {
        amount: "plusieurs",
        composition: "un seul mot à la fois, en grande serif étroite crème, en casse normale, posé chaque fois à un autre endroit de l'image, sans fond ni boîte ; les mots étirés tapés lettre à lettre puis fondus",
        case: "normal",
        weight: "regular",
        tracking: "normal",
      },
      colors: ["#fffcc0"],
      layout: "ses produits l'un après l'autre en vertical plein cadre, un mot posé sur chacun à un autre endroit de l'image, sur lui ou à côté",
      moments: [
        { at: 0, what: "son présentoir vide, plan fixe ; un appel étiré tapé lettre à lettre à gauche du milieu, puis effacé en fondu" },
        { at: 0.7, what: "un mot qui l'arrête, trois fois en 0,4 s, chaque fois ailleurs (en haut à gauche, à droite, en bas à gauche), le troisième un peu plus grand" },
        { at: 1.73, what: "« regarde » seul au milieu jusqu'au premier produit" },
        { at: 2.3, what: "sept produits, un par temps (0,62 s), coupes sèches ; sur chacun le même mot pointé, posé d'un coup chaque fois à un autre endroit, sur le produit ou à côté" },
        { at: 6.77, what: "toute la série réunie, une main pose la dernière pièce ; une hésitation tapée lettre à lettre, tenue, puis effacée, la musique coupée" },
        { at: 8.27, what: "le dernier mot seul au milieu, la musique repart, jusqu'à la fin" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      motion: "chaleureux",
      music: "playful pizzicato and finger-snap groove with a cheeky staccato bass, 96 BPM",
      ending: "toute sa série réunie, le dernier mot seul au milieu jusqu'à la fin",
      why: "Le même mot répété sur chaque produit fait sourire et donne le rythme : chacun a son temps de gloire, et l'hésitation de la fin fait attendre le dernier, toute la série.",
    },
  }),
  model({
    key: "routine",
    name: "Rituel du matin",
    // Written on its original's fiche (v1 of its skill, docs/fiches/routine.md): a « day in my life » of 58,5 s kept
    // within 45 s: its trailer of flashes under a title typed with its cursor, her ritual gesture by gesture at the
    // counter, what she made from above, her place shot by shot, the rest of her day in its longest versions; its lo-fi
    // beat at 90,73 BPM (Gemini heard 100 to 110 and a guitar), its soft natural light, no grain nor dark corners.
    pitch: "La bande-annonce de ta journée sous un titre tapé lettre à lettre, puis ton rituel du matin geste par geste au comptoir, servi vu d'en haut, et ton lieu qui ouvre.",
    needs: "ton rituel du matin filmé de face téléphone posé (une préparation geste par geste, en une ou plusieurs vidéos), ce que tu as préparé vu d'en haut, et 4 à 11 plans de ton lieu (ton enseigne, tes coins, ton équipe, toi au travail)",
    files: [5, 22],
    pair: "grotesque",
    // No reference composition: its skill's code is its reference.
    example: null,
    // Its lo-fi beat, measured on its kicks (docs/fiches/routine.md: 35 of its 43 strongest low hits on its grid within 30 ms).
    tempo: 90.73,
    finish: { name: "Lumière du matin", hint: "lumière naturelle douce, blancs neutres, ombres chaudes, noirs un peu levés, sans grain ni coins sombres", contrast: -0.04, warmth: 0.04, fade: 0.04 },
    look: {
      name: "rituel du matin, titre tapé",
      format: "pov",
      hook: { kind: "pov", what: "treize éclairs de sa journée à venir, un tous les cinq images, sous un titre tapé lettre à lettre au milieu avec son curseur" },
      text: {
        amount: "une ligne",
        composition: "un titre en minuscules italiques très serrées sur deux lignes au milieu de l'image, tapé lettre à lettre avec un curseur fin, crème et à plat, une petite ligne fine en italique dessous ; rien d'autre de tout le Reel",
        case: "normal",
        weight: "bold",
        tracking: "tight",
      },
      colors: ["#f6e2c1"],
      layout: "une bande-annonce de ses plans à venir en éclairs sous le titre, puis ses plans un à un, son rituel filmé de face téléphone posé ; en 16:9 sur du noir si ses vidéos sont en largeur",
      moments: [
        { at: 0, what: "la bande-annonce : 13 éclairs de 4 ou 5 images, chacun un moment d'un plan à venir dans l'ordre du Reel, sous le titre tapé lettre à lettre avec son curseur, puis sa petite ligne d'un coup ; tout part à la coupe" },
        { at: 2.07, what: "son rituel au comptoir, filmé de face à hauteur de poitrine, téléphone posé : un geste par plan (0,4 à 1,6 s, coupes au même endroit), les ingrédients qui entrent un à un, chaque préparation finie présentée des deux mains" },
        { at: 23, what: "ce qu'elle a préparé, posé et servi, vu d'en haut" },
        { at: 24.4, what: "son lieu plan par plan : son enseigne, ses coins, ses gens, elle qui entre dans la salle, elle au travail, ses plans d'activité plus longs" },
        { at: 42.2, what: "la suite de sa journée en plans courts, puis trois images noires, le son coupé net" },
      ],
      camera: "mixte",
      grade: "natural",
      motion: "epure",
      music: "soft lo-fi hip-hop beat, mellow chords, swung kick, no vocals, 91 BPM",
      ending: "le dernier plan de sa journée, puis trois images noires, le son coupé net",
      why: "La bande-annonce promet la journée et le titre tapé accroche ; puis un rituel geste par geste, apaisant à regarder, et son lieu qui ouvre : intime et vrai, on a envie d'y aller.",
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
  "carte-feutre": { pour: "un message de quelques mots qui s'écrit sur ses images et finit sur ce qu'elle annonce (une soirée, une invitation, une offre, un horaire)", pas_pour: "un Reel sans message, un sujet au milieu de l'image (le carnet le cache), un geste qu'il faut voir bouger (tout y devient image fixe)" },
  pile: { pour: "montrer son travail en série (réalisations, coupes, pièces) avec une phrase courte qui dit qui on est", pas_pour: "des vidéos qui racontent une histoire, une voix" },
  "mon-travail": { pour: "se présenter avec son travail en série (bouquets, coupes, plats, pièces, céramiques), soi au milieu", pas_pour: "sans photo ou vidéo de soi debout, des vidéos qui racontent une histoire, une voix" },
  "photo-dump": { pour: "une semaine, un événement, l'envers du décor en vrac, beaucoup de photos", pas_pour: "un message précis, une offre" },
  table: { pour: "ses photos de ce qu'elle fait posées comme des tirages sur sa table, puis son lieu et ses gestes côte à côte : un moment chaleureux, un savoir-faire", pas_pour: "sans photos de son travail, une rue, un message à lire" },
  "ecran-partage": { pour: "le geste et le résultat côte à côte (l'artisan et sa pièce, la coiffeuse et la coupe, le chef et l'assiette)", pas_pour: "un seul sujet, un lieu" },
  cadre: { pour: "faire entrer dans un lieu (un couloir, une salle), une ouverture, des travaux", pas_pour: "sans plan large de son lieu, des produits seuls en gros plan" },
  fenetres: { pour: "une sortie, un quartier, un voyage, des lieux qui défilent, son lieu de jour et de nuit", pas_pour: "des produits seuls, une offre à lire, quelqu'un qui parle" },
  facade: { pour: "une ouverture, un lancement, présenter sa devanture", pas_pour: "sans vidéo fixe de la devanture filmée de face" },
  gaufre: { pour: "une annonce élégante, un nom, une nouvelle collection, comme un faire-part", pas_pour: "un Reel rythmé ou drôle" },
  "mot-cle": { pour: "quelqu'un qui parle face caméra (un conseil, une explication, une liste, un chiffre), assis devant un mur uni", pas_pour: "des images sans parole, quelqu'un filmé de loin ou en mouvement" },
  frappe: { pour: "présenter un lieu au soleil, une terrasse, une saison", pas_pour: "un intérieur sombre, des produits seuls" },
  "titre-derriere": { pour: "un nom de lieu, de quartier ou de région en grand, une rue avec des toits, un paysage, un ciel", pas_pour: "sans plan large et fixe avec du ciel en haut" },
  journee: { pour: "raconter une journée du lieu, du matin au soir, son ambiance", pas_pour: "une offre, un produit seul" },
  rallume: { pour: "un lieu le soir avec ses lumières (un bar, un restaurant, un café, une boutique éclairée), une soirée, l'hiver, une réouverture", pas_pour: "sans plan large de son lieu vu de l'intérieur, un lieu en plein jour sans lumières, des produits seuls en gros plan" },
  "plans-fixes": { pour: "un lieu calme et beau, une ambiance, l'heure dorée", pas_pour: "un Reel rythmé, une annonce" },
  "coups-de-fouet": { pour: "l'énergie d'une rue, d'un quartier, d'un lieu animé", pas_pour: "un lieu calme, un long message" },
  tourne: { pour: "un savoir-faire, des matières, un lieu, un look graphique de cinéma", pas_pour: "sans vidéos filmées en largeur" },
  nike: { pour: "l'effort, le geste, l'énergie (sport, danse, un service en plein rush)", pas_pour: "un lieu calme, des produits" },
  eventail: { pour: "une ouverture graphique, un lieu, une marque qui ose", pas_pour: "un message à lire" },
  coulisses: { pour: "montrer son lieu et ses gestes comme un créateur montre ses coulisses : chaque bruitage nommé, la timeline du montage", pas_pour: "une offre à lire, quelqu'un qui parle, une ambiance calme" },
  interrupteur: { pour: "présenter sa marque, un lancement, une soirée, son logo qui s'allume", pas_pour: "sans vidéo d'elle qui saute ou tend le bras vers un point d'un mur clair, filmée fixe" },
  interface: { pour: "faire suivre son compte, une nouvelle page, un lancement, ce qu'on fait en trois mots", pas_pour: "montrer son lieu ou ses produits en vidéo (une seule photo, petite et ronde), quelqu'un qui parle" },
  pixel: { pour: "une recette, une préparation en étapes, une ambiance chaleureuse", pas_pour: "un lieu, une rue, quelqu'un qui parle, des vidéos filmées à la main" },
  "mots-meles": { pour: "un jeu, une devinette, un message caché, un lieu calme : quelqu'un qui fait une chose simple", pas_pour: "un Reel rythmé, plusieurs plans, une vidéo qui bouge" },
  aplat: { pour: "présenter une personne (la patronne, l'équipe) et son lieu avec de la couleur, une marque qui ose la couleur", pas_pour: "sans vidéo de quelqu'un qui marche, une offre à lire en détail" },
  detourages: { pour: "présenter un lieu, un paysage ou une sortie avec de l'élan, un nom à faire retenir", pas_pour: "sans plan large et fixe de son lieu ou de son paysage" },
  createur: { pour: "quelqu'un qui explique en parlant face caméra et montre ce dont il parle (ses produits, ses réalisations, son lieu, son site)", pas_pour: "des images sans parole, quelqu'un qui parle sans rien à montrer" },
  silhouette: { pour: "se présenter (elle ou quelqu'un de son équipe), présenter son métier et ce qu'elle fait, un lancement, un ton de studio graphique", pas_pour: "des produits seuls, un lieu sans personne, une offre à lire" },
  vision: { pour: "son lieu fréquenté filmé de haut, quelqu'un d'immobile au milieu et des gens qui passent autour ; un ton tech ou graphique", pas_pour: "un lieu vide, un plan qui bouge, des produits en gros plan, un message à lire" },
  "court-metrage": { pour: "raconter sa journée, son quartier ou une sortie comme un petit film, une ouverture, une saison, de belles lumières (le matin, l'heure dorée)", pas_pour: "une offre à lire, quelqu'un qui parle, des vidéos sombres ou toutes en gros plan" },
  "titre-cinema": { pour: "son lieu ou une sortie racontés comme un court film signé de son nom : son métier en un mot, un lieu au soir, une escapade, une ambiance", pas_pour: "sans plan large et fixe où quelqu'un se tient avec du ciel au-dessus, une offre à lire, quelqu'un qui parle" },
  "celui-la": { pour: "montrer ses produits un par un avec humour et en rythme (une collection, des nouveautés, ses pièces, ses gâteaux, ses bouquets, ses réalisations)", pas_pour: "un lieu, quelqu'un qui parle, une offre à lire en détail, un seul produit" },
  routine: { pour: "raconter son matin et son lieu (un café, une boulangerie, une boutique, un studio, un atelier) : sa préparation geste par geste, puis l'ouverture et sa journée", pas_pour: "une offre à lire, un produit seul, sans vidéo de sa préparation filmée téléphone posé" },
};

/** The models for Edith: their key, name, what they do, what they want, and what only she can film for one. */
export function houseModelsForEdith(): { key: string; nom: string; ce_que_ca_fait: string; il_faut: string; pour?: string; pas_pour?: string; a_lui_dire?: string }[] {
  return HOUSE_MODELS.map((m) => {
    const film = filmWords(m.look);
    const when = HOUSE_WHEN[m.key];
    return { key: m.key, nom: m.name, ce_que_ca_fait: m.pitch, il_faut: m.needs, ...(when ? { pour: when.pour, pas_pour: when.pas_pour } : {}), ...(film ? { a_lui_dire: film } : {}) };
  });
}
