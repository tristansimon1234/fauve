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
/** The catalogue's version: a studio's row written by an older one is rewritten when the model is used again (3: its original's sheets; 4: no brand in a model's name; 5: Mots aux quatre coins as its original; 6: Plans fixes at 65 BPM; 7: four renamed; 8: Lieu tapé without its original's orange; 9: Plans fixes on its fiche; 10: Une journée chez toi on its fiche; 11: ten models on their fiches; 12: Façade qui se construit and Coulisses façon fiche on their fiches; 13: Recette cosy on its fiche; 14: Titre gaufré on its fiche; 15: Mots mêlés and Interrupteur on their fiches; 16: Interface minimaliste and Fenêtres et étiquettes on theirs; 17: Mot clé en grand and Face caméra et références on theirs; 18: Photos posées sur la table and Carte au feutre on theirs; 19: « S'abonner » in Interface minimaliste; 20: the last four on their fiches, Aplat, Détourages, Silhouette and Vision machine; 21: Tristan's review of 6 November, Court métrage's light and lettering, Plans fixes' lettering, Façade's first pieces, Présente-toi in its own design, the kaléidoscope, Mot clé en grand and Face caméra et références; every model vertical by default, its band only when she asks; 22: Vision machine v2, any fixed shot of her place; 23: Voici mon travail v3, its words where her picture lets them read; 24: Façade v4, its pieces her picture's own elements). */
export const HOUSE_VERSION = 24;

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
    needs: "3 à 12 vidéos ou photos de ton lieu : des sujets debout au centre, plein de petits moments, un plan calme, quelqu'un qu'on suit, toi ou quelqu'un de l'équipe en entier, caméra posée, et des photos de tes lieux",
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
      layout: "six bandes verticales côte à côte, puis une bande de vidéo qui s'ouvre derrière le titre et grandit, en plein écran vertical (en 16:9 sur du noir comme l'original à sa demande)",
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
      layout: "des mots posés le long des bords du cadre sur le premier plan, en plein écran vertical (en 16:9 sur du noir comme l'original à sa demande)",
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
      layout: "ses images coupées en 3 × 4 tirages posés à la main sur un papier gris clair, une fine marge et un trait clair ; entières dans un bloc 16:9 à sa demande",
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
      layout: "plein cadre, ses photos en stop motion une toutes les 3 images, et par-dessus un carnet ouvert gris clair, sans ombre, qui change de pose à chaque mot ; en deux bandes à sa demande",
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
    pitch: "Toi debout dans ton lieu, tes mots en très grand derrière toi, et les photos de ton travail qui se posent en rafale derrière toi, puis repartent une à une.",
    needs: "une photo (ou une vidéo d'au moins 6 s) de toi debout dans ton lieu, téléphone posé, plutôt d'un côté avec de la place à côté de toi, et 15 à 40 photos de ton travail",
    files: [16, 41],
    pair: "grotesque",
    example: null,
    // Its landmarks on this grid (docs/fiches/mon-travail.md): its original's music has no beat, a clicking that slows down.
    tempo: 120,
    finish: { name: "Naturel" },
    look: {
      name: "voici mon travail",
      format: "collage",
      hook: { kind: "promesse", what: "elle debout dans son lieu, quelques mots en très grandes capitales derrière elle, et ses travaux qui se posent en rafale derrière elle" },
      text: {
        amount: "un message tenu",
        composition: "2 à 4 mots courts en grandes capitales grasses, un par ligne, à la même taille, du début à la fin : derrière elle quand chaque ligne s'y lit, sinon à côté d'elle ou sous son visage, jamais dessus, d'une couleur lisible sur le fond",
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
      layout: "sa table en plein cadre, ses photos tirées posées en pile au centre, puis un écran partagé en deux moitiés l'une sur l'autre ; en 4:3 sur du noir, ses moitiés côte à côte, à sa demande",
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
      hook: { kind: "geste", what: "l'écran coupé en deux : quelqu'un au travail d'un côté, ce que son geste donne de l'autre, au même moment" },
      text: {
        amount: "une ligne",
        composition: "deux petits titres en serif de labeur blanc, romain, la première lettre en capitale, un sur chaque moitié juste sous le milieu de la carte, qui se répondent (qui fait, puis ce que ça donne), tenus tout le Reel",
        weight: "regular",
      },
      layout: "l'écran coupé en deux moitiés qui se touchent : côte à côte comme l'original, l'une sur l'autre quand ses vidéos sont horizontales ; sa carte sur du noir à sa demande",
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
      layout: "son plan large figé en noir et blanc plein écran et, au milieu, un cadre debout sans bord qui montre ses images en couleur et grandit à chaque coupe ; debout comme l'original",
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
    needs: "10 à 14 vidéos de ton lieu, de ta rue ou de ton quartier : un beau plan large pour ouvrir (il revient à la fin), quelqu'un debout au milieu, le même endroit le jour et la nuit, des plans larges et courts",
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
      layout: "plein écran vertical (16:9 sur du noir à sa demande) : le plan suivant entre par une grille 3 × 3, des fenêtres qui sautent, une fenêtre derrière quelqu'un ; jour et nuit côte à côte puis en damier",
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
    // 22 (v4 of its skill): each piece an element of her own picture cut along its edges, then its regions (Tristan: « le
    // montage devrait détourer la photo pour adapter les formes »).
    pitch: "Ta devanture se construit sur le noir, élément par élément détouré (ta porte, tes fenêtres, ton enseigne), chacun sur une note, puis ta façade entière qui s'anime.",
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
      layout: "un fond noir, avec les éléments de sa façade détourés (sa porte, ses fenêtres, puis les pans de son mur) posés d'un coup à leur place, sa vidéo jouant dedans, jusqu'à l'image entière",
      moments: [
        { at: 0, what: "son enseigne apparaît d'un coup sur le noir, détourée, puis trois éléments de sa façade loin l'un de l'autre, lentement, chacun sur une note" },
        { at: 2.8, what: "une rafale de douze morceaux : ses autres éléments, puis les pans de son image (son mur, son soubassement, le trottoir)" },
        { at: 4.4, what: "un silence, rien de nouveau" },
        { at: 5.3, what: "les derniers grands morceaux (la rue, le reste du haut, tout ce qui reste noir), sur trois temps" },
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
      layout: "sa devanture qui se construit sur du noir, puis un papier pêche plein cadre où son nom est gaufré ; une vidéo horizontale recadrée sur sa devanture (en bande 16:9 à sa demande)",
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
    // first keyword and loses its bass mid-way. v2: what she says written once by its small line (the engine's subtitles
    // step aside), her photo of each name of a list under that name.
    pitch: "Tu parles face caméra devant un fond uni, et le mot important de chaque phrase s'affiche en grand au-dessus de ta tête ; quand tu cites tes produits, chacun en grand dans sa police, sur sa photo.",
    needs: "une vidéo de toi qui parles face caméra (20 à 30 s), assise devant un mur uni, téléphone posé, la tête vers le milieu de l'image, avec ta vraie voix ; si tu peux, la même prise d'un second téléphone, et une photo de chaque chose que tu cites",
    files: [1, 12],
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
        composition: "au-dessus de sa tête : ses premiers mots puis le mot clé de chaque idée en capitales grasses, le reste de ce qu'elle dit en petit au-dessus, mot à mot, jamais deux fois ; une liste deux noms à la fois, chacun dans sa police, sur sa photo",
        case: "upper",
        weight: "bold",
        subtitles: false,
      },
      layout: "elle assise face caméra devant un mur uni, plein cadre vertical (en bande 16:9 sur du noir à sa demande), un autre cadre entre deux idées, les mots au-dessus de sa tête",
      moments: [
        { at: 0, what: "ses deux premiers mots glissent de la gauche, flous, rebondissent sur un souffle grave, tenus jusqu'à ce qu'elle dise la suite" },
        { at: 1.07, what: "ses mots s'écrivent un à un sur une petite ligne très espacée ; le mot clé glisse dessous sur son mot (1,73 s) et reste toute l'idée" },
        { at: 5.67, what: "coupe sur un autre cadre entre deux idées, rien au-dessus de sa tête jusqu'à la suivante" },
        { at: 7.1, what: "une liste deux noms à la fois, chacun dans sa police, le premier petit en haut, le second grand dessous, chacun sur son mot, sur sa photo plein écran quand elle en a une" },
        { at: 17.6, what: "un chiffre très condensé et ses trois mots empilés à sa droite, d'un coup, tenus 4 s" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "energique",
      music: "laid-back hip-hop beat at 108 BPM, deep sub bass, coming in after the hook",
      ending: "elle dit au revoir, ses mots en petit au-dessus de sa tête, la musique coupée avec l'image",
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
      layout: "un titre géant posé dans le ciel du premier plan, derrière le décor qui passe devant lui, en plein écran vertical (en 4:3 sur du noir comme l'original à sa demande)",
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
    needs: "10 à 16 vidéos de ta journée : plusieurs fois la même chose côte à côte (tes tasses, tes fenêtres), ton lieu de jour puis de nuit, des gens et des gestes",
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
      layout: "en plein cadre vertical (4:3 horizontal sur du noir comme l'original à sa demande)",
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
      layout: "en plein écran vertical (une image 16:9 sur du noir, son nom allumé au-dessus, à sa demande) ; ses objets allumés un par un dans la salle assombrie, puis toute la salle",
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
    // bold serif under spaced small words, no warmth, grain nor vignette its original does not have. Its pair's serif is
    // EB Garamond 700 since its v4 (HOUSE_VERSION 21: measured on its original's letters, Lora's eye was too large).
    pitch: "Des plans fixes, la caméra posée, coupés sur la musique, comme au cinéma, et un petit titre qui arrive mot par mot au centre.",
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
      layout: "plein cadre, des plans fixes l'un après l'autre (en 4:3 sur du noir à sa demande)",
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
      layout: "des plans d'une seconde enchaînés par des coupes franches, des flashs blancs et des fouets éclair (deux images floues et claires), en plein cadre vertical (en 4:3 sur du noir à sa demande)",
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
    needs: "5 à 12 vidéos de ton lieu : un plan qui ouvre avec un centre et des lignes qui en partent (vu d'en haut, d'en bas ou en perspective), tes lumières, des gens qui bougent, deux plans qui se répondent",
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
      layout: "des bandes posées en étoile sur un fond bordeaux, fenêtres sur un seul plan, puis ses plans dans un fin cadre bordeaux, en plein écran vertical (en 16:9 sur du noir comme l'original à sa demande)",
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
      layout: "plein cadre, téléphone posé, ses étapes coupées geste par geste, de petits textes posés par-dessus ; en 16:9 sur du noir à sa demande",
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
    needs: "une vidéo calme et fixe de ton lieu ou de toi au travail, d'environ 20 secondes",
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
      layout: "un seul plan fixe en plein cadre vertical (en 16:9 sur du noir comme l'original à sa demande), une grille de lettres posée sur toute l'image",
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
      layout: "en plein écran vertical (en 4:3 sur du noir à sa demande) : la silhouette sur l'aplat, son plan qui revient autour d'elle, le plan suivant posé morceau par morceau, un cadre rouge qui se referme",
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
      layout: "plein cadre aux coins arrondis (une fenêtre un peu plus large que haute sur du noir à sa demande) ; ses plans en coupes franches",
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
    // v4 of its skill (HOUSE_VERSION 21, Tristan: « trop similaire à la vidéo originale »): its idea and its signature in a
    // design of its own, on her charter's colours (else a warm ink, a warm paper and a vermilion): her greeting stamped
    // over an accent rule, her profile in one tone with « Je suis » in it and her name typed behind her head, her paper
    // turning to her accent on the break, her trade on her dark on the drop with what she does in accent blocks, her
    // name on two lines, her logo on her accent; 84,5 BPM, its break and its last hit kept.
    name: "Présente-toi",
    pitch: "Ton profil en silhouette d'un seul ton, un mot dans ta tête, ton nom qui s'écrit derrière toi, puis ton métier et ce que tu fais sur les coups, dans tes couleurs.",
    needs: "une vidéo de toi de profil devant un fond clair, téléphone posé (5 s : tu baisses la tête puis tu la relèves), ton nom, ton métier en un mot et 3 à 5 choses que tu fais",
    files: [1, 4],
    pair: "grotesque",
    // Its skill's code is its reference.
    example: null,
    // Its fiche's tempo (84,5 BPM, its bars on 1,06 · 3,90 · 6,74 · 9,58 s; house-measures.ts has no bpm for it).
    tempo: 84.5,
    finish: { name: "Aplats", hint: "des aplats exacts, sans grain ni coins sombres", contrast: 0 },
    look: {
      name: "présente-toi",
      format: "autre",
      hook: { kind: "geste", what: "sur son papier, son salut posé en grand lettre par lettre, un trait de sa couleur qui se tire dessous" },
      text: {
        amount: "plusieurs",
        composition: "une grotesque grasse et serrée : son salut en grand, un mot pâle dans sa silhouette, son nom tapé derrière sa tête, son métier en grand sur le foncé, ce qu'elle fait dans des blocs de sa couleur, son nom sur deux lignes",
        case: "normal",
        weight: "bold",
        tracking: "tight",
      },
      colors: ["#1b1714", "#efe9de", "#e0512f"],
      layout: "des aplats à ses couleurs (un foncé, un papier, sa couleur) ; sa silhouette de profil d'un seul ton foncé en bas du cadre, coupée par le bas ; les mots au milieu",
      moments: [
        { at: 0, what: "sur son papier, son salut se pose en grand lettre par lettre, un clic par lettre, un trait de sa couleur se tirant dessous" },
        { at: 1.07, what: "coupe sur le premier temps : sa silhouette de profil d'un seul ton foncé, « Je suis » en pâle dans sa tête, qui s'efface quand elle baisse la tête ; son nom se tape derrière sa tête, son nom de famille s'en va" },
        { at: 3.2, what: "la musique s'arrête : le fond passe à sa couleur, sa silhouette et son prénom restent" },
        { at: 3.9, what: "sur le drop, le foncé : « Votre » en petit et son métier en grand, en pâle, un bloc de sa couleur qui se tire dessous ; ce qu'elle fait passe sur les coups, chaque mot dans un bloc de sa couleur" },
        { at: 7.8, what: "son papier : son nom sur deux lignes, le nom en gras, un trait de sa couleur dessous" },
        { at: 9.57, what: "coupe sur la dernière mesure : sa couleur, son logo dans son foncé (sinon le nom de son lieu en capitales), la musique arrêtée sur son dernier coup" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      motion: "epure",
      music: "slow half-time electronic beat, deep held bass, a short break then the drop",
      ending: "son logo sur sa couleur, la musique arrêtée sur son dernier coup qui résonne",
      why: "Une présentation graphique : en onze secondes on retient son profil, son nom et son métier, et le passage à sa couleur sur le break relance avant le drop.",
    },
  }),
  model({
    key: "vision",
    name: "Vision machine",
    // Written on its original's fiche (v2 of its skill, docs/fiches/vision.md): one fixed shot through some ten machine
    // looks taking turns in a strobe of clean cuts; its frames blue or dotted on every person and every thing that
    // repeats there, characters and dots drawn on the picture's edges, its labels dropping letters, its place built and
    // erased cell by cell round the person who moves least; its beep at 155 BPM. Any fixed shot of her place with people.
    pitch: "Ton lieu vu par une machine : chaque personne et chaque chose dans un cadre qui clignote en bleu, reliés par des fils, puis des points, des caractères et ton lieu qui s'efface case par case.",
    needs: "un seul plan fixe de 8 à 10 s de ton lieu, téléphone posé ou tenu très immobile (de haut si tu peux : une mezzanine, un escalier) : quelqu'un qui bouge peu au milieu et des gens qui passent ou s'affairent autour",
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
      layout: "son plan plein cadre vu par une dizaine de regards de machine : fonds blancs et noirs, cadres bleus ou à points sur chaque personne et chaque chose, profondeur grise, réseau, graphe, caractères",
      moments: [
        { at: 0, what: "la personne immobile et ce sur quoi elle est, seuls sur blanc dans leurs cadres, qui clignotent : bleu, noir à points, bleu, des noirs entre" },
        { at: 0.47, what: "son lieu se construit case par case autour d'elle, les plus proches d'abord, la moitié d'un coup, les autres en fondu depuis le blanc, les plus lointaines laissées blanches" },
        { at: 1.2, what: "un premier clignotement de coupes franches : un cadre sur chaque personne et chaque chose, bleu en deux tons ou noir à points, une étiquette qui perd ses lettres ; la profondeur en gris ; le réseau des cadres reliés ; les gens en points sur leurs contours ; la personne en caractères ; des noirs" },
        { at: 3.63, what: "le graphe seul sur blanc, un point par cadre relié aux autres par des fils, des codes binaires ; puis eux dans leurs cadres dessus" },
        { at: 4.53, what: "un second clignotement plus serré, une passe toutes les deux images quand le bip double ; tout le lieu en caractères clairs sur noir" },
        { at: 7.23, what: "son lieu s'efface case par case, des plus lointaines vers la personne immobile, jusqu'à elle seule" },
        { at: 8.03, what: "la personne en caractères clairs sur noir, puis le noir" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      motion: "energique",
      music: "a held high beep retriggered on every beat, 155 BPM, a deep rumble, no drums",
      ending: "son lieu effacé case par case jusqu'à la personne immobile, en caractères clairs sur noir, puis le noir",
      why: "Son lieu ordinaire vu comme par une machine : le stroboscope de regards intrigue, chaque passe montre autre chose, et la personne immobile au milieu tient l'œil.",
    },
  }),
  model({
    key: "court-metrage",
    name: "Court métrage",
    // Written on its original's fiche (v1 of its skill, docs/fiches/court-metrage.md; its light, its title's serif and its
    // roman credit corrected in its v2, HOUSE_VERSION 21): a short travel film projected as on
    // an old projector, its picture with rounded corners on a soft black, opened from a slit, its title card in lemon
    // yellow, its film burns, the film slipping in the gate in its middle, a shot a bar, its fade to black.
    pitch: "Ta journée en court métrage projeté, dans la lumière dorée d'une vieille pellicule : l'image s'ouvre depuis une fente, le titre de ton film en jaune, une brûlure de pellicule, un plan par mesure, la pellicule qui saute au milieu, puis un fondu au noir.",
    needs: "5 à 10 vidéos de ta journée à l'horizontale, dans une belle lumière (le matin, l'heure dorée, un contre-jour) : un intérieur calme pour ouvrir, ta rue, ton trajet, tes gestes, une vue calme pour finir",
    files: [4, 10],
    pair: "generique",
    // Its skill's code is its reference.
    example: null,
    // Its cuts' grid (docs/fiches/court-metrage.md): seven cuts within an image at 85,5 (its music's onsets say 85,3).
    tempo: 85.5,
    // 21 (v2 of its skill, Tristan: « lumière ne va pas »): the original's golden print, measured on its shots (amber mids,
    // saturation 0,4 to 0,6, its blacks a little lifted, its highlights held), not « film »'s grey; its skill draws it on
    // her shots itself (this finish serves the chain when it makes the Reel without the skill).
    finish: { name: "Pellicule dorée", hint: "doré, chaud et riche, noirs à peine relevés, hautes lumières retenues, sans grain ni coins sombres", exposure: -0.06, contrast: 0.12, saturation: 0.18, warmth: 0.6, shadows: "#C8A070", highlights: "#E8C890", split: 0.6, fade: 0.15 },
    look: {
      name: "court métrage projeté",
      format: "pov",
      hook: { kind: "promesse", what: "l'image qui s'ouvre depuis une fente au milieu, dans une pellicule aux coins arrondis, et le titre du film en jaune qui s'y pose d'un coup" },
      text: {
        amount: "une ligne",
        composition: "un générique sur le premier plan : un petit mot en capitales serif un peu espacées en haut, le titre en grandes capitales d'un serif à fort contraste sur deux lignes serrées au milieu, une signature en petit romain en bas, en jaune citron",
        case: "upper",
        weight: "bold",
        tracking: "tight",
      },
      colors: ["#f2ea4a"],
      layout: "chaque plan dans une image de pellicule 1,94:1 aux coins arrondis sur un noir doux, au milieu du cadre quand ses vidéos sont horizontales",
      moments: [
        { at: 0, what: "le noir avec un déclic, puis l'image qui s'ouvre depuis une fente au milieu, deux bandes noires qui s'écartent à vitesse égale en 2,3 s, le bruit d'un projecteur" },
        { at: 2.57, what: "sur le temps, le titre du film posé d'un coup en jaune : un petit mot un peu espacé en haut, le titre en grandes capitales d'un serif à fort contraste au milieu, une signature en petit romain en bas, avec un déclic" },
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
      // Its skill draws its own light (« film » desaturated her shots and lowered their contrast).
      grade: "natural",
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
      layout: "plein cadre (une fenêtre presque carrée, 10:9, sur du noir à sa demande) ; le titre sur le premier plan seulement",
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
      layout: "une bande-annonce de ses plans à venir en éclairs sous le titre, puis ses plans un à un, son rituel filmé de face téléphone posé ; en 16:9 sur du noir à sa demande",
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
  model({
    key: "nuit",
    name: "La nuit sous tous les angles",
    // Written on its original's fiche (v1 of its skill, docs/fiches/nuit.md): a city at night, 136,8 BPM in half time
    // (Gemini heard 85), one object at one place in six angles on a roll that speeds up, round things at one place, a lens
    // that flashes, the drop on a film burn, its night in white flashes, burns and a passer-by's hidden cut, a photographer's
    // flash that turns a silhouette white, the loop; no text in the original (its name in option), no grain (measured).
    pitch: "Ton enseigne sous tous les angles, toujours au même endroit, coupée de plus en plus vite, puis tes choses rondes qui se remplacent, un flash, le noir, et ta nuit qui tombe sur une brûlure de pellicule, en flashs blancs, jusqu'à la boucle.",
    needs: "4 à 6 vidéos de ton enseigne (ou de ton néon, ta porte) prises de différents endroits, des gros plans de choses rondes (un verre, une assiette, une lampe), et 8 à 15 vidéos de ta nuit : ta rue, ton comptoir, des passants, quelqu'un qui prend une photo, un plan large pour finir",
    files: [6, 20],
    pair: "didone",
    // No reference composition was written for it: its skill's code is its reference.
    example: null,
    // Measured on its original (docs/fiches/nuit.md): its hi-hats on every eighth from the drop, its snare every fourth beat.
    tempo: 136.8,
    finish: { name: "Nuit", hint: "nuit de cinéma : noirs relevés, blancs retenus, couleurs éteintes sauf ses lumières, sans grain", contrast: 0.08, saturation: -0.5, warmth: -0.05, fade: 0.05, vignette: 0.15 },
    look: {
      name: "nuit sous tous les angles",
      format: "pov",
      hook: { kind: "geste", what: "le même objet sous six angles, toujours au même endroit et à la même taille, coupé de plus en plus vite sur un roulement, puis des choses rondes au même endroit et un objectif qui flashe" },
      text: {
        amount: "aucun",
        composition: "aucun texte dans l'original ; son nom en option, en capitales fines et espacées au milieu du premier plan de la nuit, juste après la brûlure",
        case: "upper",
        weight: "bold",
        tracking: "wide",
      },
      filter: "nuit de cinéma : couleurs très éteintes sauf les lumières (néons, phares, taxi), noirs relevés, blancs retenus ; flashs blancs, négatifs, brûlures de pellicule chaudes, une lumière orange",
      layout: "son objet au même endroit dans chaque angle, puis des plans d'une demi-seconde à une seconde en flashs blancs, brûlures de pellicule et coupes cachées, en plein écran (16:9 sur du noir à sa demande)",
      moments: [
        { at: 0, what: "le même objet (un feu piéton) sous six angles, au même endroit et à la même taille, coupé sur chaque coup d'un roulement qui accélère, de 5 images à 2 ; le dernier tour filé" },
        { at: 1.53, what: "un flou sombre, puis des choses rondes au même endroit, une ou deux images chacune (un objectif, un bagel, une horloge, un café), et l'objectif tenu : son verre s'éclaire en blanc, l'image passe en négatif" },
        { at: 2.2, what: "le noir et un silence, puis la musique tombe sur une brûlure de pellicule chaude qui glisse vers la droite" },
        { at: 2.6, what: "la ville la nuit : le plan brûlé en blanc, figé, avant le suivant, un panneau de lumière chaude, une coupe cachée par un passant tout près de l'objectif, un métro qui passe" },
        { at: 7.97, what: "une lumière orange, une enseigne au néon en négatif (la nuit blanche, ses lumières sombres), deux images blanches, puis l'enseigne ; un étal qui arrive en négatif ; un taxi qui passe devant quelqu'un de dos" },
        { at: 10.07, what: "quelqu'un prend une photo : son appareil devient blanc, l'image passe sous un voile blanc, sa silhouette devient blanche, puis le noir et la brûlure" },
        { at: 11.13, what: "un dernier plan large de la ville la nuit coupé par la même brûlure, puis la première image du Reel : il boucle" },
      ],
      sounds: [
        { at: 0.13, what: "un roulement de charleston qui accélère, un coup sur chaque coupe" },
        { at: 2.1, what: "un déclencheur d'appareil photo sur l'objectif qui flashe" },
      ],
      camera: "à la main",
      transitions: "effets",
      grade: "moody",
      motion: "energique",
      music: "half-time lo-fi trap, deep 808, crisp hi-hats, vocal chop, kick on every beat",
      ending: "un plan large de la nuit coupé d'une brûlure, puis la première image du Reel : il boucle",
      why: "L'objet qui reste au même endroit pendant que tout change autour accroche dès la première seconde, le roulement qui accélère tient jusqu'au noir, la nuit qui tombe sur le drop donne envie d'y être, et la boucle fait revoir.",
    },
  }),
  model({
    key: "bientot",
    name: "Teaser qui se charge",
    // Written on its original's fiche (v1 of its skill, docs/fiches/bientot.md): Tristan's teaser of a sewing atelier, 64
    // flashes of a tenth of a second in black and white, a small serif counter that climbs to 88 % on its own clock, her
    // word in its place, her logo then her name on the black; no steady beat in its music (79 BPM, its cuts' grid).
    pitch: "Tes gestes en éclairs de noir et blanc pendant qu'un petit compteur charge jusqu'à 88 %, puis ce qui arrive, ton logo et ton nom sur le noir.",
    needs: "une dizaine de vidéos de tes gestes de près (tes mains au travail, tes outils, tes matières), trois ou quatre de ton lieu ou de ce qui arrive, ton logo, et ce qui arrive en deux à quatre mots",
    files: [6, 20],
    // Its counter and word in a wide high-contrast serif, its name in thin spaced capitals (font-pairs.ts, « mode »).
    pair: "mode",
    // Its skill's code is its reference (no composition of the lot 5 for it).
    example: null,
    // Its music has no steady beat: the grid of its cuts (docs/fiches/bientot.md: its 64 cuts within an image at 79).
    tempo: 79,
    finish: { name: "Noir et blanc dense", hint: "noir et blanc contrasté, noirs bouchés, blancs tenus, sans grain ni coins sombres", saturation: -1, contrast: 0.22, exposure: -0.03 },
    look: {
      name: "teaser qui se charge",
      format: "message",
      hook: { kind: "mystère", what: "un petit compteur blanc qui charge au centre (1 %, 3 %, 6 %…) sur des éclairs de gestes en noir et blanc : on attend ce qui arrive" },
      text: {
        amount: "une ligne",
        composition: "un petit compteur en serif blanc au centre exact, qui monte de 3 % toutes les 3 images jusqu'à 88 %, puis le mot de ce qui arrive à sa place, dans la même lettre ; à la fin, son nom en petites capitales espacées sur le noir",
        case: "normal",
        weight: "regular",
      },
      effect: "bw",
      layout: "des éclairs de 0,1 s en noir et blanc, plein cadre (comme filmés, une horizontale entière dans une bande sur du noir, à sa demande), un petit compteur au centre, puis le noir",
      moments: [
        { at: 0, what: "des éclairs de 2 ou 3 images (64 en 6 s) de gestes, de mains et de matières de près, en noir et blanc ; au centre exact, un petit compteur blanc en serif à 1 %" },
        { at: 0.1, what: "le compteur monte de 3 % toutes les 3 images, sur sa propre horloge et pas sur les coupes, jusqu'à 88 %, jamais 100 %" },
        { at: 3.07, what: "le mot de ce qui arrive à la place du compteur, même lettre, même place ; les éclairs plus rapides" },
        { at: 4.33, what: "sept éclairs du début reviennent d'affilée, presque à reculons, sur un coup sourd ; puis le lieu et ce qui arrive (des étagères, des produits en rangées)" },
        { at: 5.9, what: "le noir, le logo en blanc, grand et centré ; un roulement de clics monte" },
        { at: 6.29, what: "un boum grave qui descend, les clics s'arrêtent ; le nom en petites capitales fines espacées au centre" },
      ],
      sounds: [
        { at: 0.68, what: "deep 808 bass hit" },
        { at: 4.32, what: "deep 808 bass hit, as earlier flashes come back" },
        { at: 5.92, what: "a roll of short mechanical ticks, 25 a second, rising to the boom" },
        { at: 6.29, what: "deep 808 boom falling in pitch, the clicks stop" },
      ],
      camera: "à la main",
      transitions: "coupes nettes",
      motion: "epure",
      music: "dark minimal teaser beat, fast mechanical ticks, a low hum, deep 808 hits",
      ending: "le noir, son logo en blanc, puis son nom en petites capitales fines espacées au centre, un boum grave qui sonne jusqu'au bout",
      why: "Le compteur qui charge sans finir promet quelque chose sans le dire ; les éclairs de gestes à toute vitesse montrent le travail qui le prépare, et le noir, le logo et le boum font la révélation.",
    },
  }),
  model({
    key: "nom-de-ville",
    name: "Nom aux cinq polices",
    // Written on its original's fiche (v1 of its skill, docs/fiches/nom-de-ville.md): a 16:9 travel film of a city, its
    // name giant in its sky behind its roofs, rising slowly while its typeface changes at once on four beats, then cuts
    // on the same pulse, a plunge down an alley as its music drops and breaks, the life of the place, a sunset cut dead.
    pitch: "Le nom de ton quartier ou de ton lieu en géant dans le ciel, derrière tes toits, qui change de police à chaque temps, puis tes plans sur le rythme jusqu'au coucher du soleil.",
    needs: "un plan large et fixe de ta rue, de tes toits ou d'un paysage avec un ciel calme en haut, un plan qui avance dans une rue ou un passage, et 8 à 12 autres plans de la vie de ton lieu (des gens, des détails, un coucher de soleil)",
    files: [4, 15],
    pair: "affiche",
    // Its skill's code is its reference.
    example: null,
    // Its first piece's grid, 142,4 BPM counted one beat in two (its four faces and its first five cuts on its beats
    // within an image; its second piece, 150,5 BPM, is not kept: one music).
    tempo: 71.2,
    finish: { name: "Ocre", hint: "chaud et terreux, hautes lumières jaune crème, ombres presque noires, sans grain ni coins sombres", contrast: 0.12, saturation: -0.04, warmth: 0.14, shadows: "#16120C", highlights: "#EDCC74", split: 0.18 },
    look: {
      name: "nom aux cinq polices",
      format: "pov",
      hook: { kind: "pov", what: "un plan large et fixe de ses toits au soleil bas, son nom géant dans le ciel derrière eux, dont la police change d'un coup à chaque temps" },
      text: {
        amount: "une ligne",
        composition: "un nom de lieu en capitales très grasses dans le ciel, le pied derrière les toits, sa police changée à chaque temps (ronde, carrée, étroite, carrée plus grande, la sienne) ; de petits mots blancs au-dessus, une signature en bas",
        case: "upper",
        weight: "black",
        tracking: "tight",
      },
      colors: ["#fd4c4c"],
      layout: "un nom géant posé dans le ciel du premier plan, derrière ses toits, en plein écran vertical (en 16:9 sur du noir comme l'original à sa demande), puis ses plans en plein cadre",
      moments: [
        { at: 0, what: "un plan large et fixe de ses toits au soleil bas ; son nom géant dans le ciel, le pied derrière les toits, qui monte lentement ; deux à quatre petits mots blancs au-dessus, une signature en petit en bas" },
        { at: 0.6, what: "à chaque temps (0,42 s), la police du nom change d'un coup, en une image, à la même place et dans la même couleur : très grasse et ronde, carrée, étroite, carrée plus grande, puis la sienne, qui reste jusqu'à la coupe" },
        { at: 2.27, what: "coupe sur le temps : quatre détails d'un temps chacun où quelque chose bouge (un toit, une ruelle vue d'en haut, le ciel entre deux murs, quelqu'un dans une cour)" },
        { at: 3.97, what: "sur un gros coup de basse, un long plan qui avance au ras d'une ruelle, la caméra levée vers le ciel ; un temps plus tard la batterie s'arrête et le son résonne" },
        { at: 6.33, what: "un deux-roues passe au ras de l'objectif, la caméra au sol ; la musique revient au milieu du plan" },
        { at: 7.27, what: "la vie du lieu, un plan tous les deux ou trois temps : une place animée, un chat qui marche vers l'objectif, des gens qui passent, un rayon de lumière dans un passage couvert, le soleil qui perce un toit" },
        { at: 13.8, what: "un coucher de soleil derrière une silhouette, coupé net avec la musique" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "energique",
      music: "warm lo-fi hip-hop beat, melodic sample, a deep bass drop then a break",
      ending: "un coucher de soleil derrière une silhouette, coupé net avec la musique ; ni texte, ni logo",
      why: "Le nom dans le ciel qui change de police à chaque temps accroche dès la première seconde et donne le tempo ; les coupes le reprennent, la ruelle fait respirer la musique, et la vie du lieu donne envie d'y aller.",
    },
  }),
  model({
    key: "carnet",
    name: "Ton produit raconté",
    // Written on its original's fiche (v1 of its skill, timed on her voice, docs/fiches/carnet.md): her voice over her
    // pictures of what she presents, cut on her words; her first words small one by one, then its name very big; a number
    // typed digit by digit; her face once in a lit round on black, 1,61 times closer on her last phrase; her question laid
    // around her object; small subtitles; black after her last word. Its music: a soft bed, its weak pulse at 89,8 BPM.
    pitch: "Tu présentes en parlant ce que tu fais ou ce que tu vends : ta voix sur tes images, son nom en très grand quand tu le dis, un chiffre qui se tape, ton visage dans un hublot rond sur du noir, ta question posée autour de lui.",
    needs: "une vidéo de toi qui parles face caméra (20 à 40 s) de la chose que tu présentes, et 6 à 11 photos ou vidéos d'elle : levée dans ta main, seule sur un fond uni vue de dessus, ses détails de près, tes mains au travail, ton lieu",
    files: [2, 12],
    // Its words in a very bold grotesque in lowercase (the original's SF Pro Heavy: Inter Tight, its skill sets it at 800).
    pair: "grotesque",
    example: null,
    // Its music's weak pulse (89,8 BPM: house-measures.ts has no bpm for it, no beat leads its cuts).
    tempo: 90,
    finish: { name: "Noirs profonds", hint: "ses images telles quelles, des noirs purs, sans grain ni coins sombres", contrast: 0.04 },
    look: {
      name: "produit raconté, hublot",
      format: "raconte",
      voice: "quelqu'un parle",
      hook: { kind: "promesse", what: "sa main lève la chose dans le cadre ; ses premiers mots s'écrivent un à un en petit, puis son nom en très grand dessous au moment où elle le dit" },
      text: {
        amount: "plusieurs",
        composition: "quelques mots en très grand, minuscules très grasses, chacun sur son mot : le nom de la chose sous ses premiers mots en petit, un chiffre tapé chiffre à chiffre, une question autour de l'objet ; de petits sous-titres gras sinon",
        case: "normal",
        weight: "black",
        tracking: "tight",
        subtitles: true,
      },
      layout: "ses images de la chose en plein écran coupées sur ses mots, sa voix dessous ; une fois, son visage dans un rond de lumière sur du noir ; les grands mots au milieu",
      moments: [
        { at: 0, what: "sa main lève la chose dans le cadre ; ses premiers mots s'écrivent un à un en petit au milieu, un toutes les 5 images, chacun d'un coup à sa place sur une ligne posée d'avance" },
        { at: 0.67, what: "le nom de la chose en très grand juste dessous, sur son mot, 81 % de la largeur, posé sur la chose ; parti 0,6 s plus tard" },
        { at: 1.37, what: "la chose sous un projecteur sur du noir, puis ses détails de tout près et ses mains, des plans de 0,2 à 0,8 s coupés sur ses mots" },
        { at: 7.03, what: "un chiffre tapé chiffre à chiffre en très grand au milieu, un toutes les 4 à 5 images à sa place finale, son unité en petit dessous sur son mot ; puis la suite de sa phrase un mot à la fois, une image par mot" },
        { at: 10.33, what: "10 images de noir, puis d'un coup son visage dans un rond de lumière sur du noir (la moitié de la largeur, 1,36 fois plus haut), ses sous-titres dessous" },
        { at: 14.1, what: "sur le premier mot de sa dernière phrase, la même image 1,6 fois plus près, en une image" },
        { at: 15.5, what: "sa question en très grand autour de la chose posée au milieu, un mot à la fois : en haut à gauche, dessous à droite, petit en bas à gauche, en travers dessous ; une chose de plus posée sur chaque mot ; puis « ? » seul au milieu" },
        { at: 23.13, what: "il lève une pièce devant l'objectif sur chaque chose qu'il cite" },
        { at: 36.67, what: "noir pur jusqu'à la fin, la musique coupée avec" },
      ],
      sounds: [{ at: 15.88, what: "soft thud, on each thing laid on the stack during the question" }],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "natural",
      motion: "energique",
      music: "soft lofi chill beat, felt piano, vinyl crackle, about 90 BPM, under a voice",
      ending: "l'ancien posé, le nouveau montré face à l'objectif, puis 0,7 s de noir",
      why: "On regarde la chose pendant qu'elle en parle : chaque mot important tombe en très grand à l'instant où il est dit, et son visage, une seule fois dans le hublot, rend le moment personnel.",
    },
  }),
  model({
    key: "petites-lumieres",
    name: "Petites lumières",
    // Written on its original's fiche (v1 of its skill, docs/fiches/petites-lumieres.md): three still pictures of a city at
    // dusk where only lights move, on a beat that stops dead three times; its second example is the same song.
    pitch: "Trois images immobiles de ton lieu le soir où seules tes lumières bougent sur la musique : ta lampe ou ton enseigne qui clignote, tes fenêtres qui s'allument en rouge, un soleil derrière tes toits quand ton ciel se voit, puis tout s'éteint d'un coup.",
    needs: "3 photos ou vidéos fixes de ton lieu le soir : une de tes lumières de près (lampe, enseigne, néon), ta rue ou ta façade avec des fenêtres et du ciel au-dessus des toits, une façade de face",
    files: [3, 4],
    pair: "editorial",
    // Its original's skill is its reference: no composition of its own.
    example: null,
    // Its music's tempo, measured on its original (the fiche: its hits on the grid, its three stops on its beats).
    tempo: 83,
    finish: { name: "Sarcelle du soir", hint: "teal et orange du soir : ombres bleu-vert, hautes lumières chaudes, contrasté, ses rouges francs, sans grain ni coins sombres", contrast: 0.14, saturation: 0.06, shadows: "#0a2626", highlights: "#f2c693", split: 0.3 },
    look: {
      name: "petites lumières",
      format: "autre",
      hook: { kind: "mystère", what: "une image immobile de la ville au crépuscule où seule une lampe s'allume quatre images sur le premier coup de la musique, puis clignote quand elle revient" },
      text: {
        amount: "aucun",
        composition: "aucun texte dans l'original ; quand il faut des mots, son nom allumé comme un néon dans le ciel ou la partie calme du dernier plan, qui reste allumé quand tout s'éteint",
        case: "normal",
        weight: "regular",
        tracking: "normal",
      },
      layout: "trois images fixes en plein cadre vertical, l'une après l'autre ; seules leurs lumières changent, posées dessus",
      moments: [
        { at: 0, what: "un lampadaire devant un ciel de couchant, éteint ; il s'allume quatre images sur le coup grave de l'ouverture, s'éteint quand la musique s'arrête" },
        { at: 1.1, what: "trois clignotements de quatre images, deux éteinte entre eux, quand la musique revient, puis allumé 1,4 s ; éteint juste après la caisse claire, avant le deuxième arrêt" },
        { at: 4.13, what: "coupe sur la reprise : une cour d'immeubles vue d'en bas, un disque rouge plat dans son ciel, derrière les immeubles, qui rétrécit lentement ; ses fenêtres se remplissent de rouge en six vagues du bas vers le haut" },
        { at: 6.67, what: "coupe sur le tic du troisième arrêt : des tours au couchant ; une colonne de fenêtres s'allume en cramoisi du bas vers le haut, en quatre pas" },
        { at: 8.9, what: "toutes les fenêtres s'éteignent d'un coup ; la musique se coupe, l'image reste immobile jusqu'à la fin" },
      ],
      sounds: [{ at: 6.62, what: "a short high rim click, alone in the music's third stop" }],
      camera: "fixe",
      transitions: "coupes nettes",
      grade: "moody",
      motion: "epure",
      music: "dark lo-fi trap beat, deep 808, crisp hats, dry snare, about 83 BPM",
      ending: "tout s'éteint d'un coup, la musique se coupe, l'image reste seule et immobile",
      why: "Rien ne bouge sauf la lumière : l'œil cherche ce qui va s'allumer, chaque lumière tombe sur un coup de la musique, et la ville le soir devient une petite chorégraphie.",
    },
  }),
  model({
    key: "vlog-ville",
    name: "Ta ville racontée",
    // Written on its original's fiche (docs/fiches/vlog-ville.md; its skill, skills/vlog-ville.ts, version 1): a city film
    // of 41,8 s in 4:3, told in small subtitles (a voice tells the original), cut by ear on what is said.
    pitch: "Ton quartier en court-métrage raconté : tes premiers mots un à un, la musique qui tombe sur ton nom avec une rafale de gros plans, ton nom en grandes capitales rouges (ou à ta couleur) entre guillemets sur toi de dos, puis ta ville qui bouge jusqu'au retour au plan du titre.",
    needs: "15 à 30 vidéos de ton quartier et de toi : un plan large et calme avec toi au milieu, un détail plein de choses (ta carte, une étagère), toi de dos immobile pendant que tout passe, des passants, de la foule, des lumières le soir, toi qui marches",
    files: [6, 16],
    pair: "film-large",
    // Its skill's code is its reference.
    example: null,
    // Measured on its original (docs/fiches/vlog-ville.md): its music's pulse at 76 (Gemini heard 75); its cuts follow
    // what is said, not the beat, but for its drop on her name.
    tempo: 76,
    finish: { name: "Film doux", hint: "blancs retenus, noirs un peu levés, ombres bleu-vert et hautes lumières chaudes, rouges francs, sans grain ni coins sombres", contrast: 0.08, saturation: -0.1, fade: 0.05, shadows: "#1C2B2E", highlights: "#E6DCC0", split: 0.25 },
    look: {
      name: "court-métrage de ville raconté",
      format: "raconte",
      voice: "voix off",
      hook: { kind: "pov", what: "un plan large et calme, quelqu'un d'immobile au milieu, une phrase qui arrive mot à mot en petits sous-titres, puis la musique qui tombe sur le nom du lieu avec une rafale de gros plans d'un détail" },
      text: {
        amount: "plusieurs",
        composition: "de petits sous-titres blancs en minuscules en bas de l'image, une phrase à la fois ; au titre, le nom en grandes capitales rouges très larges entre guillemets au centre, une signature en petit au-dessus, une ligne minuscule dessous",
        case: "upper",
        weight: "black",
        tracking: "tight",
        subtitles: true,
      },
      colors: ["#d7261e"],
      filter: "couleurs de cinéma retenues : les blancs jamais au-dessus de 215 sur 255, les noirs un peu levés, des ombres bleu-vert et des hautes lumières chaudes, des rouges francs (le titre, les lanternes, les rames), sans grain visible ni coins sombres",
      layout: "des plans plein cadre (en 4:3 sur du noir à sa demande), coupés à l'oreille sur ce qui est dit ; trois rafales de plans de deux à six images",
      moments: [
        { at: 0, what: "un plan large et calme, quelqu'un d'immobile au milieu, le son de la ville ; sa première phrase arrive mot à mot en petits sous-titres, puis la deuxième, qui finit sur le nom du lieu" },
        { at: 2.63, what: "la musique tombe sur le nom : neuf gros plans d'une carte pleine de détails, deux et trois images chacun, puis le même plan filé" },
        { at: 6.13, what: "quelqu'un de dos, immobile, devant une rame qui passe ; une demi-seconde plus tard le nom en grandes capitales rouges entre guillemets sur son dos, une signature au-dessus, une petite ligne dessous ; la musique étouffée, plus de sous-titre jusqu'à 7,93 s" },
        { at: 8.57, what: "la ville qui bouge, une phrase de sous-titre par plan ou deux : quelqu'un sur un bateau, de l'eau, des escalators, la foule, des portiques, une verrière" },
        { at: 17.3, what: "une rue sous des lanternes, puis une rafale de nuit : un feu piéton, un panneau, un néon, des phares, chacun de deux à six images" },
        { at: 24.57, what: "une rafale qui rappelle les plans déjà vus, les gros plans de la carte dans leur ordre, sur une phrase qui dit le chaos et le mouvement" },
        { at: 26.83, what: "le tournant : des plans calmes quand la phrase dit de ralentir ; quelqu'un qui lève les yeux, assis de dos, une contre-plongée qui tourne, une image brûlée de blanc" },
        { at: 31.6, what: "le premier lieu à nouveau, des rappels, la nuit sur le fleuve, quelqu'un qui marche vers la caméra" },
        { at: 39.9, what: "le plan du titre à nouveau, sans le titre, la rame plus lente, sur la dernière phrase qui reprend la première : la boucle" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "film",
      motion: "epure",
      music: "cinematic downtempo hip-hop, deep 808 sub hits, soft piano, airy pads, 76 BPM",
      ending: "le plan du titre à nouveau, sans le titre, le monde plus lent, sur la dernière phrase qui reprend la première : la boucle",
      why: "Une voix raconte la ville comme un court-métrage : les sous-titres tiennent l'attention, les rafales tombent sur ce qui est dit, et le nom en rouge sur quelqu'un d'immobile pendant que tout passe dit où l'on est.",
    },
  }),
  model({
    key: "assiettes",
    name: "Défilé d'assiettes",
    // Written on its original's fiche (v1 of its skill, docs/fiches/assiettes.md): her menu dish by dish, each plate seen
    // from above in the middle of the frame, cut on what is heard, a title typed over the first ones, a vedette held
    // while the music settles, a near silence, the drop and the rest of the menu at full speed, looping.
    pitch: "Tes plats vus d'en haut qui défilent sur la musique, un titre qui se tape lettre à lettre sur les premiers, un plat vedette tenu pendant que la musique se pose, puis le reste de ta carte à toute vitesse sur le drop.",
    needs: "12 à 30 courtes vidéos ou photos de tes plats (ou de tes produits) vues d'en haut, chacun tenu à la main au-dessus du même comptoir, l'assiette au milieu de l'image ; un plat plus beau que les autres pour la vedette",
    files: [6, 20],
    pair: "menu",
    // Its skill's code is its reference.
    example: null,
    // Its drop's grid (docs/fiches/assiettes.md): its 30 cuts within an image at 91,6 (its intro's vocal has its own pace).
    tempo: 91.6,
    finish: { name: "Gourmand", hint: "chaud et franc, couleurs des plats vives, noirs profonds, sans grain ni coins sombres", warmth: 0.08, contrast: 0.06, saturation: 0.06 },
    look: {
      name: "défilé d'assiettes",
      format: "pov",
      hook: { kind: "promesse", what: "un plat coloré vu d'en haut, tenu à la main, et un titre qui se tape lettre à lettre au milieu, une ligne fine en serif tapée dessous derrière un curseur" },
      text: {
        amount: "une ligne",
        composition: "un titre court en capitales condensées très grasses, blanc, tapé lettre à lettre au milieu ; juste dessous, une ligne fine en serif droite en minuscules, tapée en même temps derrière un curseur ; les deux partent d'un coup",
        case: "upper",
        weight: "black",
        tracking: "normal",
      },
      layout: "un défilé de plats, un à la fois en plein cadre, chacun vu d'en haut au milieu de l'image et presque aussi large qu'elle, tenu à la main au-dessus du même comptoir, sous un titre tapé lettre à lettre",
      moments: [
        { at: 0, what: "un plat coloré vu d'en haut ; son titre se tape lettre à lettre au milieu en capitales condensées blanches, une ligne en serif fine tapée dessous en même temps derrière un curseur, entiers à 1,4 s" },
        { at: 0.47, what: "un plat toutes les 0,33 à 0,6 s, chacun au même endroit de l'image, coupé sur les syllabes de la voix ; la musique sans basse" },
        { at: 3.07, what: "le titre et sa ligne partent d'un coup ; les plats continuent" },
        { at: 6.27, what: "un plat en éclair, trois images, sur un coup double de la musique" },
        { at: 6.37, what: "le plat vedette, plus gros, tenu 2,9 s : la batterie se coupe, une nappe seule, la voix revient" },
        { at: 9.95, what: "un presque-silence d'une demi-seconde sur un plat" },
        { at: 10.43, what: "le drop, une grosse basse : le reste du menu à toute vitesse, six plats par mesure sur les coups du groove, jusqu'au dernier plat" },
      ],
      camera: "à la main",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "epure",
      music: "afro trap: chopped vocal over light drums, then a heavy 808 drop, 92 BPM",
      ending: "le dernier plat en plein cadre, la musique coupée net : le Reel boucle sur le premier et son titre",
      why: "Une demi-seconde par plat, au même endroit de l'image : on reste pour voir le suivant ; le titre promet le menu, le plat vedette tenu pendant la pause fait saliver, et le drop relance jusqu'au dernier.",
    },
  }),
  model({
    key: "chef-face",
    name: "Le plat, puis la dégustation",
    // Written on its original's fiche (v1 of its skill, timed on her voice, docs/fiches/chef-face.md): her dish being
    // finished first, close-up after close-up, then she tastes it face to face, her steps on the words that name them, all
    // her words in small cream condensed capitals with her strong words big, her formula huge on two lines.
    pitch: "Tu racontes ton plat face caméra : on le voit d'abord se finir en gros plans, puis toi qui le goûtes, chaque étape au mot où tu la dis, tes mots au milieu de l'écran et ta formule de fin en très grand.",
    needs: "une vidéo de toi à table qui racontes ton plat face caméra, 3 à 8 vidéos de ton plat qui se finit en gros plans (la bouchée en dernier), une vidéo de toi qui goûtes, une par étape que tu nommes",
    files: [3, 16],
    // Its words in one very condensed bold family, small and big (Bebas Neue).
    pair: "condensee-geometrique",
    // Its skill's code is its reference.
    example: null,
    // Its original has no beat to count (his voice alone leads): the tempo of the music under her voice.
    tempo: 96,
    finish: { name: "Gourmand", hint: "chaud et contrasté, couleurs riches, sans grain ni coins sombres", warmth: 0.08, contrast: 0.08, saturation: 0.1 },
    look: {
      name: "le plat puis la dégustation",
      format: "raconte",
      voice: "quelqu'un parle",
      hook: { kind: "geste", what: "le plat qui se finit en très gros plans, un geste entier par plan, sous sa voix qui pose une question, avant qu'on la voie" },
      text: {
        amount: "plusieurs",
        composition: "tout ce qu'elle dit, deux à quatre mots à la fois, en petites capitales condensées crème au milieu de l'image ; les mots forts de chaque idée 1,75 fois plus grands à la même place ; sa formule de fin en très grand sur deux lignes",
        case: "upper",
        weight: "bold",
        tracking: "tight",
        subtitles: true,
        shadow: "soft",
      },
      colors: ["#f2e9dc"],
      layout: "elle à table face caméra, le plat devant elle, et ses gros plans du plat posés plein cadre sur ce qu'elle dit, l'un après l'autre ; ses mots sur une seule ligne au milieu",
      moments: [
        { at: 0, what: "le plat qui se finit, un geste entier par plan (verser, saupoudrer, poser), neuf gros plans de 0,5 à 1,7 s sous sa voix, ses mots deux à quatre à la fois au milieu, posés d'un coup" },
        { at: 8.23, what: "la bouchée prise à la cuillère, deux très gros plans" },
        { at: 10.2, what: "coupe sur elle à table, le plat au premier plan : quatre réactions rapides pendant qu'elle goûte, les yeux fermés, puis elle parle face caméra" },
        { at: 20.2, what: "chaque étape de la recette en gros plan, coupée sur le mot qui la nomme et tenue jusqu'à la suivante" },
        { at: 48.17, what: "elle regoûte face caméra, en sauts dans le même cadre" },
        { at: 59.03, what: "sur une coupe, après un silence, sa formule de fin en très grand sur deux lignes, sur elle" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "energique",
      music: "warm lo-fi hip-hop groove, soft drums, muted keys, round bass, under a voice",
      ending: "sa formule de fin en très grand sur deux lignes sur son visage, la musique coupée net dessous",
      why: "Le résultat d'abord donne faim avant de dire comment : on voit le plat se finir, puis quelqu'un le goûter et dire pourquoi c'est bon ; chaque étape tombe sur son mot, et la formule de fin fait sourire.",
    },
  }),
  model({
    key: "recette",
    name: "Pas à pas raconté",
    // Written on its original's fiche (v1 of its skill, docs/fiches/recette.md): a creator's recipe told by his voice,
    // the result first, each step from one place cut gesture by gesture, his words subtitled in small groups in the
    // middle of the picture in a bold serif, the end where he tastes at the lens. Played without a voice: its words are
    // the subtitles of one, a group on each gesture.
    pitch: "Ton savoir-faire pas à pas : ton résultat d'abord, puis chaque étape geste par geste, tes mots écrits au milieu comme des sous-titres, et à la fin quelqu'un qui goûte ou essaie.",
    needs: "8 à 16 vidéos filmées téléphone posé : ton résultat fini de face, chaque étape d'un seul endroit (de dessus ou de face) en plusieurs gestes, et quelqu'un qui goûte, sent ou essaie face à l'objectif",
    files: [4, 16],
    pair: "sous-titres",
    // Its skill's code is its reference.
    example: null,
    // Its original's music cannot be measured under its voice (its fiche): a lo-fi pace where a beat lasts about one of its gestures.
    tempo: 85,
    finish: { name: "Bois chaud", hint: "chaud et saturé, les hautes lumières retenues, sans grain ni coins sombres", warmth: 0.1, contrast: 0.06, saturation: 0.06 },
    look: {
      name: "pas à pas sous-titré",
      format: "autre",
      hook: { kind: "promesse", what: "son résultat fini posé devant l'objectif puis soulevé de tout près, et ses premiers mots écrits au milieu en sous-titres : ce que son savoir-faire promet" },
      text: {
        amount: "plusieurs",
        composition: "ses mots écrits au milieu de l'image comme les sous-titres d'une voix, en petits groupes d'un à trois mots qui se remplacent d'un coup, un par geste, en serif grasse minuscule d'un blanc chaud, une ombre légère, sans boîte",
        weight: "bold",
        shadow: "soft",
      },
      layout: "plein cadre, téléphone posé, chaque étape coupée geste par geste dans le même plan, ses mots posés par-dessus au milieu de l'image ; en 16:9 sur du noir à sa demande",
      moments: [
        { at: 0, what: "son résultat fini posé sur son plan de travail devant l'objectif, de face, ses premiers mots au milieu dès la première image" },
        { at: 1.03, what: "de tout près, ce qu'on en prend soulevé vers l'objectif, la promesse qui continue en sous-titres" },
        { at: 3.67, what: "chaque étape d'un seul endroit, de dessus sur le plan de travail ou de face derrière lui, coupée geste par geste dans le même plan (ce qu'on ajoute, l'un après l'autre), un petit groupe de mots par geste" },
        { at: 42.03, what: "à la fin, face à l'objectif, quelqu'un goûte ou essaie et sa réaction, le mot de la fin sous son visage" },
      ],
      camera: "fixe",
      grade: "warm",
      motion: "epure",
      music: "warm lo-fi hip-hop, soft Rhodes chords, a mellow brushed beat, 85 BPM",
      ending: "quelqu'un goûte ou essaie face à l'objectif, sa réaction tenue jusqu'au bout, le mot de la fin sous son visage",
      why: "On voit le résultat d'abord, puis comment c'est fait, geste par geste, les mots qui racontent au rythme des mains ; la réaction à la fin donne envie d'y goûter.",
    },
  }),
  model({
    key: "affiches",
    name: "Tes produits en affiches",
    // Written on its original's fiche (v1 of its skill, docs/fiches/affiches.md): a slit of her picture under her title
    // dropping word by word, then her products one a second, each in a white-bordered print on a vivid flat colour at
    // its own place, the first, the last and one in two named in very big letters, her call on black.
    pitch: "Tes produits un par un en affiches de couleur : chacun dans un tirage à bord blanc sur un aplat vif qui change chaque seconde, son nom en très grand dessous, après ton titre qui tombe mot à mot autour d'une fente.",
    needs: "5 à 12 photos ou courtes vidéos de tes produits (plats, créations, services), une chose seule et bien en vue au milieu de chacune, un gros plan pour l'ouverture (un regard, un détail), et le nom de chacun",
    files: [4, 12],
    pair: "affiche",
    // Its skill's code is its reference.
    example: null,
    // Its cuts' grid: a poster every second, two beats at 120 (its original's music, a trap beat at 134 BPM, leads none of its cuts).
    tempo: 120,
    finish: { name: "Imprimé", hint: "aplats francs et vifs, images imprimées un peu contrastées, un grain de papier fixe, sans coins sombres", contrast: 0.05, grain: 0.12 },
    look: {
      name: "affiches de couleur",
      format: "collage",
      hook: { kind: "promesse", what: "une fente horizontale qui ne montre qu'un regard ou un détail sur un aplat rouge, et les mots du titre qui tombent un à un à ses quatre coins" },
      text: {
        amount: "plusieurs",
        composition: "le titre en capitales condensées noires, un mot à la fois aux quatre coins d'une fente d'image ; sur une affiche sur deux, son nom en très grandes capitales sur le papier du tirage ; un appel en capitales blanches sur le noir",
        case: "upper",
        weight: "black",
        tracking: "tight",
      },
      colors: ["#fc1f10", "#0052b9", "#ffc91b"],
      layout: "une affiche par seconde : un aplat de couleur vive plein cadre et une seule image dans un tirage à bord blanc, posé chaque fois ailleurs et à une autre taille, deux qui sortent du cadre",
      moments: [
        { at: 0, what: "sur un aplat rouge, une fente horizontale de son image (un regard, un détail) ; les mots du titre tombent un à un toutes les 0,2 s, collés à ses quatre coins, un cinquième plus bas" },
        { at: 1, what: "une affiche par seconde, coupe sèche, sur le même rouge d'abord : une seule image dans un tirage à bord blanc, au milieu et grande, son nom en très grandes capitales noires sur le papier dessous" },
        { at: 2, what: "puis bleu roi, orange, rose, gris, noir, bleu ciel, jaune : chaque tirage à une autre place et une autre taille, au milieu, en haut, en bas ; le premier, le dernier et un sur deux portent leur nom" },
        { at: 3, what: "un tirage coupé par le bord gauche du cadre, puis un autre coupé par le haut, comme une page de magazine" },
        { at: 9, what: "sur du noir, son appel en deux lignes de capitales blanches, un mot en gras italique" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      grade: "natural",
      motion: "energique",
      music: "minimal trap beat, dotted 808 bass, crisp eighth hi-hats, dry snare, 120 BPM",
      ending: "son appel en capitales blanches sur du noir, la musique coupée net à la fin",
      why: "Chaque seconde une nouvelle couleur et un nouveau produit : l'œil reste pour voir le suivant ; le nom en très grand fait de chaque produit une affiche qu'on retient, et le titre posé mot à mot dit tout de suite ce qu'on va voir.",
    },
  }),
  model({
    key: "vitraux",
    name: "Ta devanture en kaléidoscope",
    // Written on its original's fiche (v1 of its skill, docs/fiches/vitraux.md): an old building's door straight on, re-made
    // at every image by an AI (its leaves doubling, its panes in symmetric patterns, its fanlight turning half a turn), the
    // stone around it still, then back to the real door for the loop, over a soft house loop at 123,4 BPM (Gemini heard 95
    // and a slit-scan); here mirrors laid on her own picture, which invent nothing: since v2 a true kaleidoscope (v1's
    // sliding strips were « très moyen » for Tristan on a bookshop's front). No text in the original (her name in option).
    pitch: "Ta devanture, ta porte ou ta vitrine filmée bien droite devient un kaléidoscope : huit miroirs s'ouvrent en cercle depuis son milieu, tournent et la recomposent en rosaces de ses propres couleurs, puis elle redevient elle-même : une boucle qu'on regarde deux fois.",
    needs: "une vidéo fixe et bien de face (ou une photo bien droite) de ta porte, ta devanture, ta vitrine, une étagère ou ton présentoir, sans personne qui passe devant",
    files: [1, 3],
    // Its name, in option, in big capitals of a high-contrast serif, a thin spaced line under it (font-pairs.ts, « didone »).
    pair: "didone",
    // Its skill's code is its reference.
    example: null,
    // Measured on its original (docs/fiches/vitraux.md): a kick on every beat, on the grid within 5 ms.
    tempo: 123.4,
    finish: { name: "Lumière du jour", hint: "lumière naturelle, couleurs franches, noirs profonds, sans grain ni coins sombres", contrast: 0.06, saturation: 0.04 },
    look: {
      name: "devanture en kaléidoscope",
      format: "autre",
      hook: { kind: "mystère", what: "sa devanture ou sa vitrine filmée bien droite, de face, où un kaléidoscope s'ouvre en cercle depuis son milieu dès la première seconde" },
      text: {
        amount: "aucun",
        composition: "aucun texte dans l'original ; son nom en option, en grandes capitales centrées au-dessus de la rosace où le kaléidoscope se retire, sur sa vraie image, une petite ligne en capitales espacées dessous",
        case: "upper",
        weight: "bold",
        tracking: "wide",
      },
      layout: "un seul plan fixe plein cadre vertical, de face ; un kaléidoscope de huit miroirs qui remplit sa chose (ou une rosace ronde, ou des battants), le reste de l'image vrai autour",
      moments: [
        { at: 0, what: "sa chose vraie, de face, deux images" },
        { at: 0.07, what: "un kaléidoscope de huit miroirs s'ouvre en cercle depuis le milieu de sa chose, vite puis plus doucement, jusqu'à la remplir à 1,56 s" },
        { at: 1.56, what: "il tourne et se recompose à chaque image, jamais sur le temps : des rosaces de ses propres couleurs, ses lettres devenues des motifs, le reste de l'image vrai autour" },
        { at: 6.18, what: "son nom en option : le kaléidoscope se retire dans une rosace ronde au milieu, son nom en grandes capitales au-dessus, sur sa vraie image, sa petite ligne dessous" },
        { at: 7.4, what: "la rosace se referme, lentement puis plus vite ; sa vraie image revient à 8,5 s" },
        { at: 8.5, what: "sa chose vraie, comme à la première image : la boucle" },
      ],
      camera: "fixe",
      grade: "natural",
      motion: "epure",
      music: "soft deep house loop, four-on-the-floor sub kick, mellow chord stabs, 123 BPM",
      ending: "sa vraie image, comme la première, tenue un temps, la musique coupée net : le Reel boucle sans qu'on voie la reprise",
      why: "Sa chose à elle se transforme sous nos yeux sans jamais cesser d'être la sienne : on cherche comment c'est fait, on regarde jusqu'au retour à la vraie image, et la boucle fait revoir.",
    },
  }),
  model({
    key: "curseur",
    name: "Un clic sur tes produits",
    // Written on its original's fiche (v1 of its skill, docs/fiches/curseur.md): a desktop cursor over her real video, as
    // on a computer: a click pauses it and the music, a click opens the close-up of her products, a click on each writes
    // its name with a hand-drawn arrow, a click clears them, a double click goes back, a last click plays it all again.
    pitch: "Un curseur d'ordinateur met ta vidéo en pause d'un clic, ouvre la photo de près de ce que tient ton équipe, écrit d'un clic le nom de chacun de tes produits, puis relance la vidéo et la musique.",
    needs: "une vidéo de ton lieu où quelqu'un passe ou s'avance avec ce que tu vends à la main (filmée téléphone posé), et une photo de près de deux de tes produits côte à côte",
    files: [2, 3],
    // Its names in a very condensed bold family, as its original's labels (Bebas Neue).
    pair: "condensee-geometrique",
    // Its skill's code is its reference.
    example: null,
    // Its original has no beat to count (its sound is its street's, cut by its first click and back on its last): its
    // moments counted at 90 BPM, a beat every 20 images, its first click on beat 2.
    tempo: 90,
    finish: { name: "Soleil et sarcelle", hint: "chaud et net, ombres bleu-vert, hautes lumières crème, couleurs franches, sans grain ni coins sombres", contrast: 0.08, saturation: 0.06, warmth: 0.06, shadows: "#0A1A1E", highlights: "#F0D3A8", split: 0.25 },
    look: {
      name: "curseur qui clique",
      format: "autre",
      hook: { kind: "geste", what: "un curseur d'ordinateur, la flèche blanche en pixels, qui entre dans une vraie vidéo de son lieu et clique à côté de quelqu'un : l'image et le son se mettent en pause" },
      text: {
        amount: "plusieurs",
        composition: "le nom de chaque produit en grandes capitales condensées blanches, posé d'un coup sur son clic dans l'espace libre près de lui, une flèche fine dessinée à la main qui va du produit au mot ; les deux partent d'un coup sur un clic",
        case: "upper",
        weight: "bold",
        tracking: "normal",
      },
      layout: "plein cadre vertical : sa vidéo de son lieu, la photo de près de ses produits ouverte d'un clic, puis la vidéo qui reprend ; un curseur blanc en pixels par-dessus tout du long",
      moments: [
        { at: 0, what: "sa vidéo de son lieu joue : quelqu'un sort ou s'avance avec ce qu'il porte ; à 0,33 s un curseur d'ordinateur (une flèche blanche en pixels cerclée de noir, grande comme un dixième de l'image) entre par la gauche et file en ligne droite jusqu'à côté de la personne" },
        { at: 1.33, what: "un clic (la flèche se rétracte une image) : l'image se fige et le son s'arrête net ; dans le silence, la flèche glisse sur ce que la personne tient" },
        { at: 2.27, what: "un clic sur ce qu'elle tient : coupe sur la photo de près de deux produits, figée" },
        { at: 2.77, what: "un clic sur le premier produit : son nom en grandes capitales condensées blanches apparaît d'un coup au-dessus de lui, une flèche fine dessinée à la main du produit au mot" },
        { at: 3.63, what: "un clic sur le second produit : son nom et sa flèche apparaissent de même, dans l'espace libre près de lui" },
        { at: 5.37, what: "un clic à l'écart : les deux noms et leurs flèches partent d'un coup" },
        { at: 6.47, what: "la flèche monte en haut de l'image, un double clic : retour sur la vidéo de son lieu, toujours figée là où elle s'était arrêtée" },
        { at: 7.93, what: "la flèche redescend sur la personne, un clic : la vidéo repart et le son revient ; la personne s'en va, la flèche sort du cadre en bas à gauche" },
      ],
      sounds: [
        { at: 1.33, what: "computer mouse click, the video pauses and the music stops dead" },
        { at: 2.27, what: "computer mouse click, alone in the silence, on the cut to the close-up" },
        { at: 2.77, what: "computer mouse click on the first product, its name appears" },
        { at: 3.63, what: "computer mouse click on the second product" },
        { at: 5.37, what: "computer mouse click, the names go" },
        { at: 6.47, what: "computer mouse double click, back to the video" },
        { at: 7.93, what: "computer mouse click, the video and the music play again" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "epure",
      music: "sunny warm lo-fi groove, soft drums, mellow keys, round bass, 90 BPM",
      ending: "sa vidéo qui a repris et continue, la personne qui s'en va, le curseur sorti du cadre en bas à gauche",
      why: "On croit voir quelqu'un jouer avec la vidéo sur son ordinateur : la pause et le silence surprennent, chaque clic fait apparaître le nom d'un produit, et la vidéo qui repart avec le son donne la chute.",
    },
  }),
  model({
    key: "bienvenue",
    name: "L'accueil, puis la rafale",
    // Written on its original's fiche (v1 of its skill, docs/fiches/bienvenue.md): her welcome sentence written by hand,
    // a line more on each of four calm shots of her place before it opens (darker, paler), a snap with each, no music; then
    // the drop, her words gone, and the life of her place in a burst of twenty shots in five seconds, to her place full.
    pitch: "Ton lieu au calme avant l'ouverture, ta phrase d'accueil qui s'écrit à la main un mot par plan, puis le drop : la vie de ton lieu en rafale, jusqu'à ta salle pleine.",
    needs: "4 vidéos calmes de ton lieu vide, filmées téléphone posé (ta salle, un coin, un petit détail qui bouge, tes produits alignés), puis 10 à 20 courtes vidéos de ton lieu au travail (tes gestes de près, tes résultats, ton équipe, tes clients, ta salle pleine)",
    files: [6, 24],
    // Its capitals drawn by hand with a fine even stroke, spaced (Mynerve).
    pair: "main-levee",
    // Its skill's code is its reference.
    example: null,
    // Its drop's grid (docs/fiches/bienvenue.md): its 23 cuts within an image at 91,7 (its intro's voice has its own pace).
    tempo: 91.7,
    finish: { name: "Accueil", hint: "ses plans calmes assombris par le modèle, sa rafale chaude et vive, sans grain ni coins sombres", warmth: 0.05, contrast: 0.04, saturation: 0.04 },
    look: {
      name: "accueil mot à mot",
      format: "pov",
      hook: { kind: "pov", what: "son lieu vide et calme avant l'ouverture, assombri, et le premier mot de sa phrase d'accueil écrit à la main au milieu de l'image" },
      text: {
        amount: "une ligne",
        composition: "sa phrase d'accueil en capitales dessinées à la main d'un trait fin, jaune fluo ou de sa couleur claire, un mot par ligne empilé au milieu de l'image, une ligne de plus à chaque plan, sans ombre ni fond",
        case: "upper",
        weight: "regular",
        tracking: "wide",
        stroke: "thin",
        lines: "aligned",
        tilt: 0,
        shadow: "none",
      },
      layout: "quatre plans calmes de son lieu assombris, sa phrase empilée au milieu, un mot de plus à chaque plan, puis une rafale de plans courts de son lieu au travail, chacun en plein cadre",
      moments: [
        { at: 0, what: "son lieu vide en plan large, fixe et assombri ; le premier mot de sa phrase arrive d'un coup au milieu à 0,17 s, en capitales jaunes écrites à la main, sans musique" },
        { at: 0.83, what: "un coin de son lieu, puis à 1,5 s un petit détail qui bouge, puis à 2,03 s ses produits alignés : un mot de plus sous les autres sur chaque coupe, empilés au milieu de l'image, un claquement de doigts chacun" },
        { at: 2.73, what: "le drop : les mots partent d'un coup, la musique entre avec sa grosse basse, la lumière revient ; quatre plans de 0,16 s sur le temps" },
        { at: 3.4, what: "la rafale : quinze plans de 0,13 à 0,43 s, ses gestes de près, ses résultats, son équipe et ses clients, son lieu plein, coupés sur le groove" },
        { at: 7.43, what: "son lieu plein en plan large, la musique jusqu'à la dernière image" },
      ],
      sounds: [
        { at: 0.17, what: "single finger snap, sur le premier mot (la voix de l'original compte)" },
        { at: 0.83, what: "single finger snap, sur le deuxième mot" },
        { at: 1.5, what: "single finger snap, sur le troisième mot" },
        { at: 2.03, what: "single finger snap, sur le dernier mot, avant le drop" },
      ],
      camera: "mixte",
      transitions: "coupes nettes",
      grade: "natural",
      motion: "fait_main",
      music: "afro trap beat, heavy 808, syncopated drums, full energy from beat one, 92 BPM",
      ending: "son lieu plein en plan large, la musique jusqu'à la dernière image",
      why: "Le calme avant l'ouverture et une phrase qui s'écrit mot à mot font attendre ; le drop libère tout d'un coup : la vie du lieu en vingt plans, ses gestes, ses résultats, son équipe. On a envie d'entrer.",
    },
  }),
  model({
    key: "raccords",
    name: "Plans qui s'emboîtent",
    // Written on its original's fiche (v1 of its skill, docs/fiches/raccords.md): six shots chained by raccords, each one
    // arriving first over the one before, exactly where it will be, in pieces on the music's hits (a double exposure, nine
    // cells that light up on the beat, its subject cut out in three pieces, then whole: the match), a word blinking big
    // over the first.
    pitch: "Tes plans qui s'emboîtent : chaque image arrive en avance sur la précédente, à sa place exacte, en morceaux sur les coups de la musique (en neuf cases, puis détourée), et la coupe la fait jouer ; ton mot en très grand clignote sur la première.",
    needs: "4 à 9 vidéos ou photos avec quelque chose de net au milieu : toi ou quelqu'un de près qui bouge, un plan large de ta rue ou de ta salle, un plan graphique de près (une lampe, ton enseigne, une vitrine), ton intérieur avec quelqu'un devant, un objet vu d'en haut, un produit tenu devant l'objectif",
    files: [4, 9],
    // Its word in very bold, round and wide capitals across the frame (Montserrat).
    pair: "ronde-large",
    // Its skill's code is its reference.
    example: null,
    // Its music's grid (docs/fiches/raccords.md): 95,0 BPM on its sixteenths.
    tempo: 95,
    finish: { name: "Naturel contrasté", hint: "ses images telles quelles, un peu de contraste, à peine chaudes, un grain fin, sans coins sombres", contrast: 0.06, warmth: 0.05, grain: 0.12, grain_size: "fine" },
    look: {
      name: "plans qui s'emboîtent",
      format: "collage",
      hook: { kind: "geste", what: "quelqu'un de près qui sourit et tourne la tête, et un seul mot géant de sa couleur qui clignote image par image sur elle pendant une demi-seconde" },
      text: {
        amount: "une ligne",
        composition: "un seul mot en capitales très grasses, rondes et larges, plein, sans contour ni ombre, sur toute la largeur du premier plan, qui clignote image par image une demi-seconde ; rien d'autre",
        case: "upper",
        weight: "black",
        tracking: "normal",
      },
      layout: "plein cadre, chaque plan suivant posé en avance sur le plan en cours, à sa place exacte : son image en neuf cases carrées au milieu, ou son sujet détouré par morceaux, avant la coupe",
      moments: [
        { at: 0, what: "quelqu'un de près qui sourit et tourne la tête ; son mot géant clignote image par image (allumé, éteint, allumé, éteint, tenu sept images, deux éclairs), plus rien à 0,5 s" },
        { at: 0.77, what: "le plan suivant apparaît dans les clairs du premier (son ciel), ses sombres (les cheveux) devant, de plus en plus, jusqu'à la coupe à 1,3 s" },
        { at: 1.77, what: "sur le plan large, l'image suivante se pose en neuf cases carrées au milieu, sombres : une, la colonne, la croix, les neuf, sur quatre coups en 0,6 s" },
        { at: 2.6, what: "coupe sur ce plan, ses cases à leur place, éteint ; il s'allume en trois images sur le temps fort, la basse revient" },
        { at: 3.37, what: "ce qui se détache dans le plan suivant arrive détouré en trois morceaux, à sa place (les bords, puis le milieu) ; coupe à 4,13 s" },
        { at: 4.73, what: "encore en trois morceaux, la coupe sur le temps fort de la mesure suivante à 5,4 s" },
        { at: 5.87, what: "une main qui tient un objet arrive détourée d'un seul morceau ; la coupe la garde à la même place, et le Reel finit sur elle" },
      ],
      camera: "mixte",
      transitions: "effets",
      grade: "natural",
      motion: "energique",
      music: "lo-fi boom bap, warm held bass, chopped breaks without the bass, 95 BPM",
      ending: "le dernier plan, l'objet tenu devant son lieu, arrivé détouré avant la coupe et gardé à sa place, jusqu'au bout de la cassure de la musique",
      why: "L'œil ne saute jamais : ce qu'on va regarder est déjà là avant la coupe, à sa place, et se construit en morceaux sur les coups ; on reste pour voir l'image suivante arriver.",
    },
  }),
  model({
    key: "aventure",
    name: "Un an de plus",
    // Written on its original's fiche (v1 of its skill, docs/fiches/aventure.md): a creator's year told as an adventure
    // film on an acoustic folk at 134,87 BPM, its counter taking one more on the drop, its cuts hidden behind what
    // passes before the lens, its plunge under a muffled music, its blow, its comeback and its people at the end.
    pitch: "Ton année comme un film d'aventure : ton compteur qui prend un an sur le temps fort, tes moments à toute allure, coupés derrière ce qui passe devant l'objectif, un coup dur, la reprise, et les tiens à la fin.",
    needs: "12 à 30 vidéos de ton année : un gros plan fort pour le compteur (un visage dans un moment fort, de la farine, des confettis, de la vapeur), tes moments, ton lieu, ton équipe et tes clients, un moment plus dur et la reprise, les tiens réunis pour finir ; et ce que tu comptes (« 5 ans », « saison 3 »)",
    files: [8, 30],
    // Its counter in tall condensed capitals (Bebas Neue, the original's grotesque), its ending card's line in a fine geometric.
    pair: "condensee-geometrique",
    // Its skill's code is its reference.
    example: null,
    // Its cuts' grid (docs/fiches/aventure.md): its music at 134,8 BPM, its cuts on a grid of 134,87, 0,107 s after its beats.
    tempo: 134.87,
    finish: { name: "Film de voyage", hint: "ombres un peu froides, hautes lumières chaudes, blancs retenus, noirs à peine levés, sans grain ni coins sombres", contrast: 0.06, warmth: 0.04, fade: 0.03, shadows: "#1C2A2E", highlights: "#E8DDC4", split: 0.18 },
    look: {
      name: "l'année en aventure",
      format: "autre",
      hook: { kind: "chiffre", what: "trois plans éclair qui passent derrière du sombre, puis la basse qui tombe sur un visage de près dans un moment fort et un compteur translucide au milieu qui prend un an sur le temps suivant" },
      text: {
        amount: "une ligne",
        composition: "un seul texte : un compteur sur deux lignes en capitales très étroites, blanches et translucides, au milieu de l'image (un mot dessus, le nombre dessous), qui passe au nombre suivant et gonfle trois images, parti trois temps après",
        case: "upper",
        weight: "regular",
        tracking: "normal",
      },
      layout: "des plans en plein cadre sur les temps, dix coupes cachées par ce qui passe devant l'objectif, un compteur posé sur le plan fort ; en 16:9 sur du noir à sa demande",
      moments: [
        { at: 0, what: "trois plans éclair (une façade en contre-plongée, une rue, un plan de nuit), chaque coupe cachée derrière quelque chose de sombre qui passe devant l'objectif ; la musique sans sa basse" },
        { at: 2.07, what: "la basse tombe sur un visage de près dans un moment fort, au ralenti : un compteur de deux lignes en capitales étroites, blanches et translucides, au milieu ; un temps plus tard son nombre prend un de plus et gonfle trois images" },
        { at: 3.2, what: "ce qui remplit l'objectif (de la poudre de couleur) cache la coupe sur une foule floue ; le compteur part d'un coup au milieu de ce plan" },
        { at: 3.53, what: "ses moments à toute allure, un plan tous les deux temps, les coupes cachées par un fouet de la caméra, une fumée qui remplit l'image, un tissu tout contre l'objectif" },
        { at: 13.27, what: "la caméra plonge dans l'eau : trois plans dessous, la musique étouffée, puis la musique revient d'un coup sur une vue d'en haut à l'air libre" },
        { at: 20.33, what: "le coup dur en quatre plans plus sombres : un bras en écharpe, l'hôpital, la tête basse, une main sur une cicatrice" },
        { at: 23.5, what: "la reprise sur un grand décor, un long plan qui tourne, un objet montré à l'objectif puis le même ailleurs quand l'eau monte du bas de l'image" },
        { at: 33.9, what: "un profil se fond une seconde dans un coucher de soleil, le seul fondu ; puis quelque chose qui file après un fouet" },
        { at: 41.3, what: "les siens : des gens qui courent vers la caméra en riant, une photo de groupe, des embrassades ; le dernier plan tenu sans la basse" },
      ],
      camera: "mixte",
      transitions: "effets",
      grade: "film",
      motion: "energique",
      music: "galloping acoustic indie folk, guitar strummed in eighths, warm bass, 135 BPM",
      ending: "les siens qui se prennent dans les bras, le dernier plan tenu sans la basse, la musique qui s'éteint",
      why: "Le compteur dit d'emblée ce qu'on fête, sur la basse qui tombe ; les plans s'enchaînent sur les temps sans qu'on voie une coupe, et le coup dur avant la reprise fait une histoire : on reste jusqu'aux embrassades.",
    },
  }),
  model({
    key: "depart",
    name: "Le grand départ",
    // Written on its original's fiche (v1 of its skill, docs/fiches/depart.md): someone at the place they leave, a bus
    // passing right before the lens and they are gone; the journey in flashes heard with their own sound and no music;
    // the music with the arrival, a crowd rushing, two small gold lines in the middle; in black and white.
    pitch: "Quelque chose passe devant toi et tu as disparu : ton trajet en éclairs, chacun avec son propre son, puis la musique arrive avec l'endroit où tu vas, plein de vie en accéléré, et deux petites lignes au milieu.",
    needs: "une vidéo de toi debout devant ton lieu, le téléphone posé (le mieux : une voiture ou quelqu'un passe tout près devant, puis tu sors du cadre), 2 à 4 courtes vidéos de ton trajet qui bougent (une vitre de train, la route, un métro, un escalier) et 1 à 3 vidéos de l'endroit où tu arrives, plein de vie",
    files: [4, 10],
    // A neo-grotesque, regular, as its two small lines.
    pair: "grotesque",
    // Its skill's code is its reference.
    example: null,
    // Its music's backbeat every 1,082 s, two beats (docs/fiches/depart.md; Gemini heard 82, measure.py 79).
    tempo: 110.9,
    // Its blacks deep but never crushed (its darkest at 9 to 18 levels).
    finish: { name: "Noir et blanc argentique", hint: "noir et blanc contrasté, noirs profonds, grain fin, coins à peine sombres", saturation: -1, contrast: 0.12, fade: 0.04, grain: 0.18, grain_size: "fine", vignette: 0.15 },
    look: {
      name: "départ, trajet, arrivée",
      format: "autre",
      hook: { kind: "mystère", what: "quelqu'un debout devant chez lui, l'image qui recule en trois sauts, puis un bus qui passe tout près devant l'objectif : il a disparu" },
      text: {
        amount: "une ligne",
        composition: "deux petites lignes au milieu de l'image vers la fin, une courte invitation puis le lieu où l'on arrive, dans une grotesque fine d'un or éteint, une ombre douce, en fondu",
        weight: "regular",
        shadow: "soft",
      },
      colors: ["#cdb672"],
      effect: "bw",
      filter: "noir et blanc contrasté aux noirs profonds, un grain fin, l'arrivée d'un gris à peine chaud",
      layout: "le départ en un plan fixe à 15 images par seconde, une masse qui passe devant l'objectif cachant la coupe, le trajet en plans éclairs, l'arrivée en plans de foule accélérés, ses deux lignes au milieu",
      moments: [
        { at: 0, what: "quelqu'un debout sur un trottoir devant chez lui, l'image qui part de près et recule en trois sauts en un sixième de seconde, saccadée à 15 images par seconde" },
        { at: 0.3, what: "un bus traverse tout près de l'objectif de la droite vers la gauche, flou, et cache toute l'image ; quand il est passé, la personne a disparu : le trottoir vide, tenu un quart de seconde" },
        { at: 1.07, what: "le trajet en éclairs, chacun avec son propre son et sans musique : l'avant d'un métro dans un tunnel, une aile d'avion sur la piste, la vitre d'un train, un escalator" },
        { at: 2.93, what: "la fin de l'escalator fonce d'un coup sur le panneau d'arrivée, 3,6 fois plus près en huit images" },
        { at: 3.2, what: "la musique arrive avec l'arrivée : une foule au téléobjectif en accéléré, en trois plans" },
        { at: 7.8, what: "deux petites lignes dorées en fondu au milieu de l'image, jusqu'à la fin" },
      ],
      camera: "mixte",
      transitions: "effets",
      motion: "epure",
      music: "calm lo-fi hip-hop, soft guitar and keys, light backbeat, no sub-bass, 111 BPM",
      ending: "la foule de l'arrivée qui court, ses deux lignes dorées au milieu, la musique coupée avec la dernière image",
      why: "Le départ tient en une seconde : un bus passe et la personne a disparu ; le trajet en éclairs, au son de chaque plan, fait le voyage, et la musique qui arrive avec la destination fait l'arrivée.",
    },
  }),
  model({
    key: "collage",
    name: "Collage qui s'emboîte",
    // Written on its original's fiche (v1 of its skill, docs/fiches/collage.md): a collage of still photos in stop motion,
    // a change every 6 images, each next image arriving in a piece over the one before (its person cut out at her place,
    // its roofs without their sky, seen through a window, a silhouette or a sky), three people cut out parading on one
    // image, two images in black and white, its last person staying on the first image: a loop. No text in the original.
    pitch: "Tes photos et vidéos qui s'emboîtent cinq fois par seconde : chaque image arrive d'abord en morceau sur la précédente (une personne détourée, tes toits sans leur ciel, ou vue dans ta vitrine ou dans une silhouette), puis entière, et la dernière personne revient sur la première : ça boucle.",
    needs: "13 à 26 photos ou courtes vidéos verticales, chacune avec un sujet net : ton lieu en large, ton équipe et tes clients debout en entier ou jusqu'à la taille, ta façade ou ta rue avec du ciel, une vitrine, un miroir ou une fenêtre, un portrait de près, des détails",
    files: [8, 26],
    // Its title (none in the original) in white condensed capitals, like a sign's letters (font-pairs.ts, « cinema »).
    pair: "cinema",
    // Its skill's code is its reference.
    example: null,
    // Its step, a sixteenth at 75 BPM (0,2 s: the original's 6 images); the original's music is at 80 BPM, on its own clock.
    tempo: 75,
    finish: { name: "Collage franc", hint: "couleurs franches et contrastées comme ses photos, deux images en noir et blanc dense, sans grain ni coins sombres", contrast: 0.06, saturation: 0.06 },
    look: {
      name: "collage qui s'emboîte",
      format: "collage",
      hook: { kind: "mystère", what: "une image fixe, et la personne de l'image suivante qui arrive détourée dessus, à sa place, avant son image : on ne sait pas où l'on va" },
      text: {
        amount: "aucun",
        composition: "aucun texte dans l'original ; quand il faut des mots, son nom en grandes capitales blanches étroites dans le haut de ses premières images, comme les lettres d'une enseigne, que les morceaux qui arrivent recouvrent par moments",
        case: "upper",
        weight: "black",
        tracking: "normal",
      },
      layout: "des photos plein cadre, une à la fois, chacune arrivant d'abord en morceau sur la précédente, chaque morceau à sa place et à sa taille dans sa propre image, sans bord ni ombre",
      moments: [
        { at: 0, what: "une image large, puis la personne de l'image suivante détourée dessus, à sa place, puis son image entière ; un changement toutes les 6 images" },
        { at: 0.6, what: "les maisons de l'image suivante sans leur ciel posées sur la précédente, dont on voit le haut à la place du ciel" },
        { at: 1, what: "trois personnes détourées défilent sur le même décor, une toutes les 0,2 s, sans jamais montrer leur fond" },
        { at: 1.6, what: "le premier plan de l'image suivante, en noir et blanc, posé sur le décor, puis son image entière en noir et blanc" },
        { at: 2.2, what: "un visage vu dans l'iris d'un œil, puis la silhouette d'un homme remplie par un bâtiment, puis des mouettes dans l'ouverture d'une arche d'arbres" },
        { at: 3.6, what: "une femme détourée arrive sur les mouettes, son image entière, puis elle reste détourée sur la première image, qui revient : la boucle, jouée deux fois" },
      ],
      camera: "fixe",
      transitions: "coupes nettes",
      grade: "natural",
      motion: "energique",
      music: "trap beat, dotted deep 808, claps on 2 and 4, crisp 16th hi-hats, 75 BPM",
      ending: "la dernière personne détourée posée sur la première image, qui revient : la boucle repart sans couture",
      why: "Chaque image annonce la suivante par un morceau d'elle, cinq fois par seconde : l'œil ne décroche pas, on cherche ce qui arrive, et la boucle fait revoir le Reel sans qu'on s'en rende compte.",
    },
  }),
  model({
    key: "en-boutique",
    name: "Création à quatre mains",
    // Written on its original's fiche (v1 of its skill, docs/fiches/en-boutique.md): someone comes into the shop with an
    // idea and what it takes, the one behind the counter makes it with them in front of the camera, every line of theirs
    // subtitled (the artisan's in yellow), its name popping over the artisan as a comic-strip sticker, a tasting to end.
    pitch: "Quelqu'un vient te lancer un défi en boutique et vous le faites à deux : son idée en plans rapides, toi derrière ton comptoir avec le nom de la création qui surgit en autocollant de BD, vos gestes, le résultat et la dégustation, toutes vos répliques en sous-titres.",
    needs: "6 à 12 vidéos : quelqu'un avec ce qu'il apporte face caméra, des gros plans de ses ingrédients ou produits, toi (ou ton équipe) derrière ton comptoir, vos gestes un à un, le résultat montré et vous deux qui goûtez ou essayez ; filmées en parlant de préférence",
    files: [4, 16],
    pair: "autocollant",
    // Its skill's code is its reference.
    example: null,
    // Its music's sections, measured on its original (docs/fiches/en-boutique.md: a beat every 0,449 s where it plays).
    tempo: 133.75,
    finish: { name: "Vlog chaud", hint: "lumineux, chaud et saturé, contraste soutenu, sans grain ni coins sombres", warmth: 0.06, contrast: 0.08, saturation: 0.1 },
    look: {
      name: "création à deux en boutique",
      format: "autre",
      voice: "quelqu'un parle",
      hook: { kind: "promesse", what: "quelqu'un face caméra avec ce qu'il apporte, ses ingrédients en gros plans rapides, qui lance le défi en sous-titres dès la première image" },
      text: {
        amount: "plusieurs",
        composition: "tout ce qui est dit en sous-titres, deux ou trois mots à la fois, grotesque très grasse blanche à l'ombre douce aux deux tiers de la hauteur, l'artisan en jaune ; un titre en autocollant de BD penché, bordé de noir, en capitales jaunes",
        case: "upper",
        weight: "black",
        subtitles: true,
        stroke: "thick",
        tilt: -5.5,
        shadow: "soft",
      },
      colors: ["#fcc83b", "#141414"],
      layout: "plein cadre vertical filmé à la main comme un vlog : les deux au comptoir, leurs gestes de près, leurs visages à la dégustation ; un autocollant de titre posé sur l'artisan qui sourit",
      moments: [
        { at: 0, what: "celui qui vient, face caméra, avec ce qu'il apporte, ses ingrédients en gros plans de 0,5 à 0,9 s, le défi lancé en sous-titres blancs" },
        { at: 4.43, what: "l'artisan derrière son comptoir, impassible, un boum grave quand il paraît" },
        { at: 7.53, what: "il sourit enfin : le nom de la création surgit sur lui en autocollant de BD avec un pop, penché, qui le fait dessous ; il repart deux secondes après" },
        { at: 10.37, what: "leur échange au comptoir, en sous-titres" },
        { at: 20.67, what: "les gestes un à un, de près, les explications de l'artisan en sous-titres jaunes" },
        { at: 58.5, what: "le résultat montré face caméra à deux" },
        { at: 61.93, what: "ils goûtent, chacun son visage, une basse qui tombe sur sa réaction, le verdict" },
        { at: 69.4, what: "un logo qui surgit sur le dernier plan large des deux" },
      ],
      sounds: [
        { at: 4.43, what: "un boum grave quand l'artisan paraît" },
        { at: 7.45, what: "un pop et une petite note de cuivres avec l'autocollant" },
        { at: 9.45, what: "un souffle quand il repart" },
        { at: 64.25, what: "une grosse basse qui glisse vers le grave sur sa réaction" },
      ],
      camera: "à la main",
      transitions: "coupes nettes",
      grade: "warm",
      motion: "energique",
      music: "playful Italian comedy groove, plucked guitar, light percussion, 134 BPM",
      ending: "le dernier plan large des deux qui ont goûté, un logo qui surgit dessus, la musique coupée avec lui",
      why: "On assiste à une vraie rencontre : le défi d'abord, l'artisan qu'on fait sourire, puis tout se fait sous nos yeux et on goûte avec eux ; les sous-titres tiennent l'attention et l'autocollant du titre donne le ton.",
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
  vision: { pour: "un plan fixe de son lieu fréquenté (de haut si possible), quelqu'un qui bouge peu au milieu et des gens qui passent ou s'affairent autour ; un ton tech ou graphique", pas_pour: "un lieu vide, un plan qui bouge, des produits en gros plan, un message à lire" },
  "court-metrage": { pour: "raconter sa journée, son quartier ou une sortie comme un petit film, une ouverture, une saison, de belles lumières (le matin, l'heure dorée)", pas_pour: "une offre à lire, quelqu'un qui parle, des vidéos sombres ou toutes en gros plan" },
  "titre-cinema": { pour: "son lieu ou une sortie racontés comme un court film signé de son nom : son métier en un mot, un lieu au soir, une escapade, une ambiance", pas_pour: "sans plan large et fixe où quelqu'un se tient avec du ciel au-dessus, une offre à lire, quelqu'un qui parle" },
  "celui-la": { pour: "montrer ses produits un par un avec humour et en rythme (une collection, des nouveautés, ses pièces, ses gâteaux, ses bouquets, ses réalisations)", pas_pour: "un lieu, quelqu'un qui parle, une offre à lire en détail, un seul produit" },
  routine: { pour: "raconter son matin et son lieu (un café, une boulangerie, une boutique, un studio, un atelier) : sa préparation geste par geste, puis l'ouverture et sa journée", pas_pour: "une offre à lire, un produit seul, sans vidéo de sa préparation filmée téléphone posé" },
  nuit: { pour: "un lieu le soir ou la nuit (un bar, un restaurant, une boutique ouverte tard), son enseigne ou son néon, sa rue la nuit, une soirée", pas_pour: "sans plusieurs angles de son enseigne ou d'un objet qui la représente, un lieu calme de jour, un long message à lire" },
  bientot: { pour: "annoncer ce qui arrive (une ouverture, une nouvelle collection, une nouvelle carte, un événement) avec ses gestes de métier, un teaser élégant", pas_pour: "un message à lire en détail, quelqu'un qui parle, un lieu calme montré lentement, trop peu de vidéos" },
  "nom-de-ville": { pour: "présenter son quartier, sa rue, sa ville ou son lieu avec du rythme, une sortie, un voyage, l'été, la lumière du soir", pas_pour: "sans plan large avec du ciel, un intérieur seul, des produits seuls, un message à lire" },
  carnet: { pour: "présenter en parlant un produit, une pièce ou un outil phare (ce qu'il a de spécial, un chiffre, pourquoi elle l'aime), avec des images de lui", pas_pour: "des images sans parole, quelqu'un qui parle sans images de ce dont il parle, un lieu sans chose à montrer" },
  "petites-lumieres": { pour: "son lieu le soir et ses lumières (sa devanture, son enseigne, ses fenêtres, ses lampes, sa terrasse), une ambiance de ville, l'hiver, une soirée", pas_pour: "un lieu en plein jour sans aucune lumière, quelqu'un qui parle, des produits en gros plan, un message à lire en détail" },
  "vlog-ville": { pour: "raconter son quartier, sa ville ou son lieu comme un court-métrage, avec des phrases (ou une voix) qui racontent tout du long et beaucoup de beaux plans", pas_pour: "une offre à lire en détail, un produit seul, peu de vidéos, un Reel court" },
  assiettes: { pour: "montrer sa carte, ses plats du jour, des idées de recettes ou une sélection de produits, un par un, filmés d'en haut au même endroit (un restaurant, un traiteur, une cantine, une boulangerie, des box)", pas_pour: "un seul plat, les gestes d'une recette, quelqu'un qui parle, un lieu, moins de six plats" },
  "chef-face": { pour: "un plat, une recette ou une spécialité racontée face caméra et goûtée (un restaurant, un traiteur, une pâtisserie, un café) : le résultat d'abord, puis la dégustation", pas_pour: "sans vidéo où elle parle, des images sans parole, un lieu ou une ambiance sans rien à goûter" },
  recette: { pour: "montrer un savoir-faire en étapes comme un tuto, pour tout métier qui a des gestes : une recette (cuisine, pâtisserie), un bouquet monté (fleuriste), une coupe (coiffeur, barbier), une pièce tournée (céramiste), un soin ; du résultat fini à la dégustation ou à l'essai", pas_pour: "un lieu ou une ambiance, une offre à lire, quelqu'un qui parle face caméra, des vidéos filmées à la main" },
  affiches: { pour: "montrer ses produits, ses plats, ses créations ou ses services un par un avec leur nom, comme des affiches colorées : une collection, une carte, des nouveautés, une sélection, ses best-sellers", pas_pour: "un lieu qui se raconte, quelqu'un qui parle face caméra, un geste qu'il faut voir en entier (l'image est petite dans son tirage), une offre à lire en détail, moins de quatre images" },
  vitraux: { pour: "montrer sa devanture, sa porte, sa vitrine, ses étagères ou son présentoir comme on ne les a jamais vus (une boutique, un café, une fleuriste, une librairie, une mercerie, un salon) : une boucle hypnotique qui fait s'arrêter, son nom en option", pas_pour: "quelqu'un qui parle, des gens qui passent devant, une vidéo filmée à la main qui bouge, une offre à lire en détail, plusieurs moments à raconter" },
  curseur: { pour: "montrer deux de ses produits avec humour, comme sur un écran d'ordinateur (un café, une boulangerie, un restaurant, un traiteur, une boutique, un fleuriste) : quelqu'un de son lieu qui les porte ou les montre, puis la photo de près des deux, chacun nommé d'un clic", pas_pour: "sans vidéo de son lieu où quelqu'un bouge, sans photo de près de ses produits, quelqu'un qui parle face caméra, un long message ou une offre à lire, un lieu sans rien à montrer" },
  bienvenue: { pour: "présenter son lieu et ce qu'on y fait (un salon, un café, un restaurant, une boutique, un studio, un atelier) : une phrase d'accueil mot à mot sur son lieu au calme, puis sa vie en rafale ; une ouverture, une réouverture, une rentrée, un nouveau lieu", pas_pour: "un seul produit, quelqu'un qui parle face caméra (ses mots s'écrivent, aucune voix), un long message à lire, moins de six vidéos (la rafale en veut une dizaine)" },
  raccords: { pour: "présenter son lieu, sa journée ou ses produits en quelques images qui s'enchaînent avec style, pour tout commerce (un café, une boutique, un salon, un atelier, un studio) : chaque plan a quelque chose de net au milieu qui arrive en avance sur le précédent", pas_pour: "un message à lire, quelqu'un qui parle face caméra, des plans flous ou sans rien de net au milieu, moins de quatre images" },
  aventure: { pour: "fêter ses années (un anniversaire, un an d'ouverture), le bilan de son année ou de sa saison, une rétrospective, un merci à ses clients et à son équipe, avec beaucoup de moments différents", pas_pour: "peu de vidéos (moins de huit), un produit seul, une offre à lire en détail, quelqu'un qui parle face caméra, un Reel court" },
  depart: { pour: "un départ et une arrivée : une sortie, un voyage, un déplacement (le marché, un salon, un fournisseur, les vacances), un déménagement ou une nouvelle adresse, un événement ailleurs", pas_pour: "sans vidéo de quelqu'un debout devant son lieu filmée téléphone posé, sans plans du trajet ni de l'endroit où l'on arrive, un produit seul, quelqu'un qui parle, une offre à lire en détail" },
  collage: { pour: "présenter son lieu, son équipe et ses clients avec de l'élan et du style (un café, une boutique, un salon, un studio, un bar), une ambiance de quartier, une saison, un événement en vrac, beaucoup de photos", pas_pour: "moins de huit photos ou vidéos, un message à lire en détail, quelqu'un qui parle face caméra, un geste qu'il faut voir bouger longtemps" },
  "en-boutique": { pour: "une création faite à deux devant la caméra (avec une cliente, un créateur, un commerçant voisin, quelqu'un de l'équipe) ou un défi relevé derrière le comptoir : un plat, une boisson, un bouquet, une coupe, une pièce, de l'idée à la dégustation ou à l'essai", pas_pour: "sans personne filmée face caméra derrière son comptoir ou à son poste, un lieu ou une ambiance sans personne, un produit seul, une offre à lire en détail, moins de quatre vidéos" },
};

/** The models for Edith: their key, name, what they do, what they want, and what only she can film for one. */
export function houseModelsForEdith(): { key: string; nom: string; ce_que_ca_fait: string; il_faut: string; pour?: string; pas_pour?: string; a_lui_dire?: string }[] {
  return HOUSE_MODELS.map((m) => {
    const film = filmWords(m.look);
    const when = HOUSE_WHEN[m.key];
    return { key: m.key, nom: m.name, ce_que_ca_fait: m.pitch, il_faut: m.needs, ...(when ? { pour: when.pour, pas_pour: when.pas_pour } : {}), ...(film ? { a_lui_dire: film } : {}) };
  });
}
