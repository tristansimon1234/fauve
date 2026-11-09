import { businessFamily, type BusinessFamily } from "./post-ideas.ts";

// How to film an idea, for someone who is not a pro and films on a phone (Tristan: « Dans quelle mesure Edith peut
// conseiller avant la conception d'un Reel », then « oui » to a real coaching rather than ideas alone; « les prompts ne
// doivent pas être des règles à rallonge »). Data, not instructions: each kind of idea is three shots (the first is the
// hook, what the first second shows), each with its length and where to stand, the light and how to hold the phone,
// written with the words of her trade and adapted to who accepts to be seen (her, her team, nobody: hands and result).
// Edith gets it from film_guide and gives the short line with an idea, the points when she asks how.

export const FILM_KINDS = ["geste", "resultat", "avant_apres", "lieu", "conseil", "coulisses", "moment"] as const;
export type FilmKind = (typeof FILM_KINDS)[number];

/** Who accepts to be seen on screen: her, someone of her team, or nobody (hands, gestures, the result). */
export const ON_SCREEN = ["elle", "equipe", "personne"] as const;
export type OnScreen = (typeof ON_SCREEN)[number];

/** The words of a trade the shot lists are written with. */
type TradeWords = {
  /** The idea « un geste » in her trade. */
  gesture: string;
  /** What a close-up of the work shows. */
  detail: string;
  result: string;
  /** The result without anyone's face. */
  resultNoFace?: string;
  /** Where to film the result from. */
  resultAngle: string;
  place: string;
  client: string;
  prep: string;
  busy: string;
  before: string;
  after: string;
  beforeNoFace?: string;
  afterNoFace?: string;
};

const TRADE: Record<BusinessFamily, TradeWords> = {
  sport: {
    gesture: "Un mouvement du cours",
    detail: "les pieds ou les mains qui travaillent",
    result: "le groupe en fin de cours",
    resultNoFace: "le groupe de dos, en fin de cours",
    resultAngle: "de loin, toute la salle dans le cadre",
    place: "la salle",
    client: "un élève",
    prep: "la salle qu'on prépare",
    busy: "le cours en plein effort",
    before: "la salle vide, avant le cours",
    after: "la salle pleine, en plein cours",
    afterNoFace: "la salle pleine, vue de dos",
  },
  beauty: {
    gesture: "Tes mains pendant un geste",
    detail: "tes mains et l'outil en plein geste",
    result: "le résultat fini sur la cliente",
    resultNoFace: "le résultat fini, de dos ou de près",
    resultAngle: "à hauteur d'yeux, à 1 m",
    place: "le salon",
    client: "une cliente installée",
    prep: "le poste qu'on prépare",
    busy: "une cliente installée, le soin en cours",
    before: "l'avant, au même endroit",
    after: "l'après, le résultat fini",
    beforeNoFace: "l'avant, de dos",
    afterNoFace: "l'après, de dos ou de près",
  },
  food: {
    gesture: "Un geste en cuisine",
    detail: "les mains et l'assiette",
    result: "le plat fini, posé sur la table",
    resultAngle: "vu d'en haut, puis à hauteur d'assiette",
    place: "la salle",
    client: "des clients à table",
    prep: "la mise en place avant le service",
    busy: "le service qui bat son plein",
    before: "les produits bruts sur le plan de travail",
    after: "le plat fini sur le plan de travail",
  },
  shop: {
    gesture: "Un produit qu'on emballe",
    detail: "le produit et sa matière, en main",
    result: "le produit en main, tourné lentement",
    resultAngle: "de près, devant un fond simple",
    place: "la boutique",
    client: "un client qui découvre un produit",
    prep: "la vitrine qu'on installe",
    busy: "la boutique ouverte, avec du monde",
    before: "la vitrine vide",
    after: "la vitrine installée",
  },
  other: {
    gesture: "Un geste de ton métier",
    detail: "tes mains et l'outil en plein geste",
    result: "le résultat fini",
    resultAngle: "de face, de près",
    place: "ton lieu",
    client: "un client",
    prep: "ce que tu prépares avant d'ouvrir",
    busy: "ton lieu en plein travail",
    before: "l'avant",
    after: "l'après, le résultat fini",
  },
};

/** One shot to film: what, how long (seconds, filmed without cutting), where to stand; `noFace` when nobody is seen. */
type Shot = { what: string; seconds: number; angle: string; noFace?: string; noFaceAngle?: string };
type Light = "hands" | "face" | "room" | "same";
type Guide = { idea: string | Partial<Record<OnScreen, string>> & { default: string }; shots: [Shot, Shot, Shot]; light: Light; lightNoFace?: Light };

const LIGHT: Record<Light, string> = {
  hands: "à côté d'une fenêtre, la lumière sur les mains, jamais dos à elle",
  face: "face à une fenêtre, la lumière sur le visage, jamais dos à elle",
  room: "rideaux ouverts et toutes les lumières allumées",
  same: "même endroit, même lumière pour l'avant et l'après",
};

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function guideOf(kind: FilmKind, t: TradeWords): Guide {
  switch (kind) {
    case "geste":
      return {
        idea: t.gesture,
        shots: [
          { what: `${t.detail}, au moment fort`, seconds: 3, angle: "de très près, à 30 cm" },
          { what: "le geste en entier", seconds: 6, angle: "un pas en arrière, sans bouger" },
          { what: t.result, seconds: 4, angle: t.resultAngle, noFace: t.resultNoFace },
        ],
        light: "hands",
      };
    case "resultat":
      return {
        idea: cap(t.result),
        shots: [
          { what: t.result, seconds: 3, angle: t.resultAngle, noFace: t.resultNoFace },
          { what: `le geste qui y mène (${t.detail})`, seconds: 4, angle: "de très près, à 30 cm" },
          { what: "le résultat en entier", seconds: 5, angle: "un pas en arrière, en tournant autour lentement" },
        ],
        light: "hands",
      };
    case "avant_apres":
      return {
        idea: "Un avant / après",
        shots: [
          { what: t.after, seconds: 2, angle: "de face", noFace: t.afterNoFace },
          { what: t.before, seconds: 3, angle: "téléphone posé au même endroit, même cadre", noFace: t.beforeNoFace },
          { what: `le geste qui fait la différence (${t.detail})`, seconds: 4, angle: "de près" },
        ],
        light: "same",
      };
    case "lieu":
      return {
        idea: `${cap(t.place)} à l'ouverture`,
        shots: [
          { what: "la porte qui s'ouvre ou une lumière qu'on allume", seconds: 2, angle: "de face, téléphone posé" },
          { what: `un tour lent de ${t.place}`, seconds: 8, angle: "à hauteur d'yeux, en marchant doucement" },
          { what: "3 détails, 2 s chacun", seconds: 6, angle: "de près, sans bouger" },
        ],
        light: "room",
      };
    case "conseil":
      return {
        idea: { default: "Ton conseil, face caméra", equipe: "Le conseil de quelqu'un de l'équipe", personne: "Ton conseil, en voix sur tes mains" },
        shots: [
          {
            what: "{qui} face caméra, le conseil en une phrase",
            seconds: 10,
            angle: "téléphone posé à hauteur d'yeux, à 1 m",
            noFace: "tes mains qui montrent le geste, ta voix en vocal à part",
            noFaceAngle: "vu d'en haut, téléphone posé au-dessus",
          },
          { what: `le geste en détail (${t.detail})`, seconds: 4, angle: "de près" },
          { what: t.result, seconds: 3, angle: t.resultAngle, noFace: t.resultNoFace },
        ],
        light: "face",
        lightNoFace: "hands",
      };
    case "coulisses":
      return {
        idea: "Les coulisses avant d'ouvrir",
        shots: [
          { what: `${t.prep}, le geste le plus net`, seconds: 3, angle: "de près" },
          { what: "{qui} qui s'active", seconds: 5, angle: "de plus loin, téléphone posé", noFace: "les mains qui s'activent, sans visage" },
          { what: "la porte qui s'ouvre, les premiers qui arrivent", seconds: 3, angle: "depuis le fond, de face", noFace: "la porte qui s'ouvre" },
        ],
        light: "room",
      };
    case "moment":
      return {
        idea: cap(t.busy),
        shots: [
          { what: `${t.busy}, le moment le plus vivant`, seconds: 3, angle: "au milieu de l'action, à hauteur d'yeux", noFace: `${t.detail}, en plein travail` },
          { what: `${t.client}, de plus près`, seconds: 4, angle: "de côté, sans gêner", noFace: "les gestes de près, sans visage" },
          { what: `${t.place} en entier`, seconds: 4, angle: "depuis un coin, téléphone posé" },
        ],
        light: "room",
      };
  }
}

/** What a close-up of the work shows in her trade (« les mains et l'assiette »). */
export const tradeDetail = (businessType: string | null | undefined): string => TRADE[businessFamily(businessType)].detail;

/** A habit read on her latest files (fileHabit in file-check.ts): the point of the list it changes. */
export type FilmHabit = "landscape" | "dark" | "shaky" | "mixed";

export type FilmGuideInput = {
  businessType: string | null | undefined;
  kind: FilmKind;
  /** Who accepts to be seen (her memory); unknown: nobody's face, hands and result only. */
  who?: OnScreen;
  /** What it is about, in her words (« le nouveau soin visage »): named in the idea. */
  subject?: string;
  /** The month (0 to 11) where she is: from November to February the day ends early. */
  month?: number;
  habit?: FilmHabit | null;
};

export type FilmGuide = {
  idea: string;
  /** One sentence to give with the idea. */
  short: string;
  /** 3 to 5 short points, when she asks how. */
  points: string[];
  shots: { what: string; seconds: number; angle: string }[];
  light: string;
  phone: string;
};

const WINTER = new Set([10, 11, 0, 1]);

/** How to film an idea of this kind, for this business, for who accepts to be seen. */
export function filmGuide(input: FilmGuideInput): FilmGuide {
  const family = businessFamily(input.businessType);
  const guide = guideOf(input.kind, TRADE[family]);
  const faceless = input.who !== "elle" && input.who !== "equipe";
  const who = input.who === "equipe" ? "quelqu'un de l'équipe" : "toi";
  const shots = guide.shots.map((s) => ({
    what: (faceless && s.noFace ? s.noFace : s.what).replace("{qui}", who),
    seconds: s.seconds,
    angle: faceless && s.noFace && s.noFaceAngle ? s.noFaceAngle : s.angle,
  }));
  const ideaWords = typeof guide.idea === "string" ? guide.idea : ((input.who ? guide.idea[input.who] : guide.idea.personne) ?? guide.idea.default);
  const subject = input.subject?.replace(/\s+/g, " ").trim().slice(0, 60);
  const idea = subject ? `${ideaWords} (${subject})` : ideaWords;
  let light = LIGHT[faceless && guide.lightNoFace ? guide.lightNoFace : guide.light];
  if (input.month !== undefined && WINTER.has(input.month) && guide.light !== "room") light += " ; avant 16 h, sinon tout allumé";
  if (input.habit === "dark") light += " (tes dernières vidéos étaient sombres)";
  if (input.habit === "mixed") light = "une seule sorte de lumière, le jour ou les lampes, pas les deux";
  const phone =
    input.habit === "landscape"
      ? "à la verticale cette fois (tes dernières vidéos étaient couchées), sans zoomer"
      : input.habit === "shaky"
        ? "posé ou tenu à deux mains, et touche l'écran sur le sujet : tes dernières vidéos bougeaient"
        : "à la verticale, posé ou tenu à deux mains, sans zoomer";
  const plan = (s: (typeof shots)[number]) => `${s.what}, ${s.angle}, ${s.seconds} s`;
  const points = [`1re seconde : ${plan(shots[0]!)}`, `Puis : ${plan(shots[1]!)}`, `Pour finir : ${plan(shots[2]!)}`, `Lumière : ${light}`, `Téléphone : ${phone}`];
  const total = shots.reduce((sum, s) => sum + s.seconds, 0);
  return {
    idea,
    short: `${idea} : 3 plans, ${total} s à filmer, avec dès la 1re seconde ${shots[0]!.what}.`,
    points,
    shots,
    light,
    phone,
  };
}
