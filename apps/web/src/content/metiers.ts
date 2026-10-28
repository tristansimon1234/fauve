import { PLANS, reelsPerMonth } from "@fauve/agent";

// One page per trade (Tristan : « quel strat SEO avoir ? »): what people who want to buy type
// (« community manager restaurant », « community manager salon de coiffure »…). Each says what
// Edith does for that trade in its words, with the real ideas the app offers it (postIdeas,
// filmIdeas, read from its `business`), its own questions and the work to show. Nothing the app
// does not do; the example businesses are never presented as clients.

export type Trade = {
  slug: string;
  /** In the footer and the menus. */
  menu: string;
  /** The page title in search results (without « · Edith »). */
  title: string;
  description: string;
  kicker: string;
  h1: string;
  accent: string;
  intro: string;
  /** What postIdeas and filmIdeas read to pick the trade's ideas. */
  business: string;
  /** Why it works for this trade: three short points. */
  points: [string, string][];
  /** The work shown: Reels of the landing (by id) and the hair salon carousel. */
  show: { reels: ("pilates" | "cafe" | "cave")[]; carousel?: boolean; note: string };
  faq: [string, string][];
  /** Guides worth reading next. */
  guides: string[];
};

const Price = `Dès ${PLANS.decouverte.priceEur} € par mois`;

/** Questions every trade asks, after its own. */
export const COMMON_FAQ: [string, string][] = [
  ["Est-ce qu’il publie sans me demander ?", "Jamais. Chaque publication attend ton oui, sur WhatsApp ou dans l’app. Tu peux aussi la télécharger et la publier toi-même."],
  [
    "Combien ça coûte ?",
    `Trois offres sans engagement : ${PLANS.decouverte.label} à ${PLANS.decouverte.priceEur} € par mois (${reelsPerMonth("decouverte")} Reels soignés), ${PLANS.essentiel.label} à ${PLANS.essentiel.priceEur} € (${reelsPerMonth("essentiel")} Reels) et ${PLANS.pro.label} à ${PLANS.pro.priceEur} € (${reelsPerMonth("pro")} Reels). Les photos avec leurs textes ne comptent pas.`,
  ],
  ["Et la musique ?", "Chaque Reel a sa musique, composée pour lui et calée sur ses coupes. Si tu préfères un son tendance, tu publies toi-même et tu l’ajoutes dans Instagram : Edith t’envoie la vidéo et la légende."],
];

export const TRADES: Trade[] = [
  {
    slug: "restaurant",
    menu: "Restaurant, café, bar",
    title: "Community manager pour restaurant, sur WhatsApp",
    description: `Edith monte tes vidéos de cuisine et de salle en Reels qui donnent faim, écrit les légendes et publie quand tu dis oui. ${Price}.`,
    kicker: "Restaurant, café, bar",
    h1: "Le community manager de ton restaurant.",
    accent: "Toi, tu restes en cuisine.",
    intro: "Filme dix secondes entre deux services et envoie-les sur WhatsApp. Edith en fait un Reel qui donne faim, écrit la légende et te demande avant de publier sur Instagram et TikTok.",
    business: "restaurant",
    points: [
      ["Ce qui donne faim", "Le plat qui arrive, le geste en cuisine, la salle qui se remplit. Pas une affiche : l’envie de venir ce soir."],
      ["Pensé pour le rush", "Pas de planning à tenir. Tu envoies quand tu as une minute, Edith te fait signe au bon moment pour publier."],
      ["Des tables, pas des vues", "Edith suit d’abord les visites de ton profil et les clics vers ta réservation, et te dit chaque semaine ce qui a marché."],
    ],
    show: { reels: ["cave", "cafe"], note: "Commerces d’exemple, vidéos libres de droits." },
    faq: [
      ["Je n’ai pas le temps de filmer pendant le service.", "Dix secondes suffisent : un plat qui sort, un geste, la salle avant d’ouvrir. Edith te dit quoi filmer et monte avec ce que tu as."],
      ["Il peut parler de ma carte et de mes prix ?", "De ce que tu lui as dit ou de ce qui est sur ton site, oui. Il n’invente jamais un plat, un prix ni un horaire."],
      ["Et TikTok ?", "Une fois ton compte relié, chaque Reel peut partir aussi sur TikTok : directement, ou dans tes brouillons TikTok selon ton compte, où tu ajoutes un son et tu publies."],
    ],
    guides: ["idees-reels-restaurant", "legende-instagram-commerce"],
  },
  {
    slug: "coiffeur",
    menu: "Salon de coiffure, barbier, beauté",
    title: "Community manager pour salon de coiffure, sur WhatsApp",
    description: `Avant, geste, après : Edith monte tes vidéos de salon en Reels soignés, écrit les légendes et publie quand tu dis oui. ${Price}.`,
    kicker: "Coiffure, barbier, beauté",
    h1: "Le community manager de ton salon.",
    accent: "Tes mains restent sur les cheveux.",
    intro: "Un avant, un geste, un après : envoie tes vidéos sur WhatsApp entre deux rendez-vous. Edith les monte, corrige la lumière, écrit la légende et attend ton oui pour publier.",
    business: "salon de coiffure",
    points: [
      ["L’avant / après, bien fait", "Le résultat d’abord, les étapes ensuite, ta lumière corrigée. Le genre de Reel qu’on enregistre pour le montrer à son coiffeur."],
      ["Discret quand il faut", "Une cliente préfère ne pas apparaître ? Edith floute son visage dès que tu le lui demandes."],
      ["Des rendez-vous, pas des likes", "Edith regarde d’abord les visites de ton profil et les clics vers ta prise de rendez-vous, et te dit ce qui marche."],
    ],
    show: { reels: [], carousel: true, note: "Carrousel d’un salon d’exemple, photos Unsplash." },
    faq: [
      ["Mes clientes n’aiment pas être filmées.", "Filme les mains, le geste, la nuque, le résultat de dos : ça suffit pour un beau Reel. Et Edith floute un visage quand tu le lui demandes."],
      ["Ça marche pour un barbier ou un institut ?", "Oui : coiffure, barbier, ongles, esthétique, tatouage. Edith adapte ses idées et ses mots à ton métier."],
      ["Je tiens à mon style.", "Edith lit ton site ou les images que tu aimes et en tire ta charte : tes couleurs, ta typo, ta lumière. Chaque Reel la suit."],
    ],
    guides: ["legende-instagram-commerce", "idees-reels-restaurant"],
  },
  {
    slug: "studio-pilates-yoga",
    menu: "Studio de Pilates ou de yoga",
    title: "Community manager pour studio de Pilates et de yoga",
    description: `Edith monte tes vidéos de cours en Reels qui donnent envie d’essayer, écrit les légendes et publie quand tu dis oui. ${Price}.`,
    kicker: "Pilates, yoga, sport",
    h1: "Le community manager de ton studio.",
    accent: "Toi, tu donnes cours.",
    intro: "Quelques secondes filmées pendant le cours, envoyées sur WhatsApp : Edith en fait un Reel qui donne envie de réserver le premier, écrit la légende et attend ton oui pour publier.",
    business: "studio de pilates",
    points: [
      ["Donner envie du premier cours", "Un POV, un mouvement, le studio avant que ça commence : ce qui fait franchir la porte à quelqu’un qui hésite."],
      ["Tes profs à l’honneur", "Un prof, son cours, le mouvement qu’il préfère. Avec une voix off si personne n’a envie de parler face caméra."],
      ["Des réservations, pas des vues", "Edith suit d’abord les clics vers ta page de réservation et les visites de ton profil, et te dit ce qui a marché."],
    ],
    show: { reels: ["pilates"], note: "Studio d’exemple, vidéos libres de droits, voix off de Victoria." },
    faq: [
      ["Je n’ose pas me filmer.", "Pas besoin de parler face caméra : un mouvement de côté, le studio avant le cours, les mains sur la barre. Edith peut poser une voix off dessus."],
      ["Ça se connecte à mon logiciel de réservation ?", "Pas directement. Edith met ton lien de réservation dans les légendes et te prépare des stories avec un lien à partager."],
      ["Des élèves apparaissent dans mes vidéos.", "Ce que tu envoies est utilisé tel quel. Si quelqu’un préfère ne pas être reconnu, demande à Edith de flouter son visage."],
    ],
    guides: ["legende-instagram-commerce", "idees-reels-restaurant"],
  },
  {
    slug: "boutique",
    menu: "Boutique et concept store",
    title: "Community manager pour boutique, sur WhatsApp",
    description: `Edith fait de tes photos et vidéos de boutique des Reels et des carrousels, écrit les légendes et publie quand tu dis oui. ${Price}.`,
    kicker: "Boutique, fleuriste, concept store",
    h1: "Le community manager de ta boutique.",
    accent: "Tes nouveautés méritent mieux qu’une photo.",
    intro: "Une nouveauté qu’on déballe, ta vitrine, un coup de cœur en main : envoie-les sur WhatsApp. Edith en fait des Reels et des carrousels, écrit la légende et attend ton oui pour publier.",
    business: "boutique",
    points: [
      ["Les nouveautés, de près", "La matière, le détail, porté ou utilisé. Ce qu’on ne voit pas sur une photo de catalogue."],
      ["Un conseil plutôt qu’une promo", "Comment bien choisir, quoi offrir à qui : des posts qu’on garde et qu’on envoie à une amie."],
      ["Des visites, en ligne et en vrai", "Edith suit d’abord les visites de ton profil et les clics sur ton lien, et te dit ce qui marche."],
    ],
    show: { reels: ["cafe", "cave"], note: "Commerces d’exemple, vidéos libres de droits." },
    faq: [
      ["Je n’ai surtout que des photos.", "Edith en fait des carrousels composés comme par un graphiste, ou un Reel de photos. Pour un Reel vivant, dix secondes de vidéo font déjà beaucoup."],
      ["Je vends aussi en ligne.", "Edith met le lien de ta boutique en ligne dans les légendes et te prépare des stories avec un lien à partager."],
      ["Fleuriste, librairie, épicerie fine… ça marche ?", "Oui. Edith adapte ses idées et ses mots à ce que tu vends."],
    ],
    guides: ["legende-instagram-commerce", "idees-reels-restaurant"],
  },
  {
    slug: "independant",
    menu: "Indépendants",
    title: "Community manager pour indépendants : coach, prof, artisan",
    description: "Coach, prof, photographe, artisan : Edith monte tes vidéos en Reels, écrit tes légendes et publie quand tu dis oui. Avec ou sans site.",
    kicker: "Indépendants",
    h1: "Le community manager des indépendants.",
    accent: "Toi, tu fais ton métier.",
    intro: "Prof de yoga, coach, photographe, céramiste, coiffure à domicile… Tu vis de tes clients, pas de ton temps sur Instagram. Envoie tes vidéos sur WhatsApp, Edith fait le reste et attend ton oui pour publier.",
    business: "indépendant",
    points: [
      ["Toi au centre, sans te forcer", "Tes mains, ton travail, ton lieu. Pas besoin de parler face caméra : Edith peut poser une voix off."],
      ["Avec ou sans site", "Pas de site ? Tu lui dis ce que tu fais en deux mots, et ton style vient d’images que tu aimes."],
      ["Des clients, pas une audience", "Edith cherche des visites de ton profil et des clics vers ton lien, pas des vues pour des vues."],
    ],
    show: { reels: ["pilates", "cafe", "cave"], note: "Commerces d’exemple, vidéos libres de droits." },
    faq: [
      ["Je n’ai pas de site.", "Aucun problème : tu dis à Edith ce que tu fais en deux mots, tu lui montres quelques images que tu aimes, et il en tire ton style."],
      ["Je travaille seul, personne ne me filme.", "Pose ton téléphone et filme tes mains, ton travail, ton lieu. Une voix off peut raconter à ta place."],
      ["Je suis créateur de contenu, c’est pour moi ?", "Edith est fait pour ceux qui vivent de leurs clients : il cherche des réservations et des visites, pas une audience. Si ton métier, c’est l’audience, d’autres outils te serviront mieux."],
    ],
    guides: ["legende-instagram-commerce", "idees-reels-restaurant"],
  },
];

export const tradeBySlug = (slug: string) => TRADES.find((t) => t.slug === slug);
