// The site's Reels (public/landing/reels): demo businesses and creators, premium ones (Tristan, 6 novembre 2026 : « il
// faut mettre en avant des commerces plus premium, il faut dire que c'est aussi pour créateurs, il faut mettre des
// exemples oui mais sans parler de modèles »). Each was made by Edith's chain on the prod bench, untouched: free Pexels
// footage, a demo business, her idea typed as she would, music Edith composed. The team chose those inputs (and the
// form each one follows); never name that form here. Shared by the wall (a client component) and the pages around it.
// raw-<id>-<k>.webp: three of the clips each one was made from. `made`: three things the Reel visibly does, in plain
// words, from watching it.

export const WORK = [
  {
    id: "concept-store",
    trade: "Concept store",
    brand: "Maison Sélène",
    brief: "La nouvelle sélection, avec de la couleur et de l’allure : ça doit donner envie de passer.",
    sent: "12 vidéos brutes",
    made: ["Détourée sur un aplat rouge", "Des plans cadrés de rouge", "Le décor qui passe en trame"],
  },
  {
    id: "cave",
    trade: "Bar à vins",
    brand: "La Cave d’Hortense",
    brief: "La cave le soir, quand les lumières s’allument et que les premiers verres se servent.",
    sent: "12 vidéos brutes",
    made: ["Un verre qui s’allume dans le noir", "Son nom en lettres fines", "Une fin dans le noir"],
  },
  {
    id: "styliste",
    trade: "Styliste",
    brand: "Mila Sato",
    brief: "Mon style, de la rue de Brooklyn à l’atelier.",
    sent: "14 vidéos brutes",
    made: ["Son nom sur un bandeau", "D’une rue à l’autre par sa silhouette", "L’atelier en noir et blanc"],
  },
  {
    id: "restaurant",
    trade: "Restaurant",
    brand: "Maison Arlette",
    brief: "Le coup de feu du soir en cuisine, jusqu’à l’assiette : ça doit donner faim.",
    sent: "10 vidéos brutes",
    made: ["Noir, blanc et rouge", "Un verbe par geste", "Le titre qui s’écrit"],
  },
  {
    id: "parfumeur",
    trade: "Parfumeur",
    brand: "Maison Odelle",
    brief: "Un parfum de la maison, des fleurs au flacon : ça doit être très chic.",
    sent: "12 vidéos brutes",
    made: ["Une étoile qui s’ouvre sur le flacon", "Noir et blanc, cadre bordeaux", "Son nom seul pour finir"],
  },
  {
    id: "joaillier",
    trade: "Joaillerie",
    brand: "Atelier Ysé",
    brief: "Les bagues de l’atelier, faites à la main, une par une.",
    sent: "12 vidéos brutes",
    made: ["Une grille qui change case par case", "Une petite étiquette", "L’or de tout près"],
  },
  {
    id: "patissier",
    trade: "Pâtisserie",
    brand: "Pistil",
    brief: "Mes créations de la semaine : le gâteau pistache-cerise, les cupcakes, le cake citron et le cake au chocolat.",
    sent: "15 vidéos brutes",
    made: ["Une couleur par coupe", "Chaque création encadrée et nommée", "Son nom pour finir"],
  },
  {
    id: "photographe",
    trade: "Photographe",
    brand: "Hugo Laval",
    brief: "Les coulisses d’un shooting au studio, avec du rythme.",
    sent: "8 vidéos brutes",
    made: ["De la pose à l’écran de l’appareil", "Une grille de fenêtres", "Pas un mot"],
  },
  {
    id: "hotel",
    trade: "Hôtel",
    brand: "Hôtel Désirade",
    brief: "Le petit-déjeuner servi en chambre, chaque matin.",
    sent: "13 vidéos brutes",
    made: ["Une carte écrite au feutre", "Un mot de plus à chaque coupe", "Le service qui passe derrière"],
  },
  {
    id: "dj",
    trade: "DJ et producteur",
    brand: "Novak",
    brief: "Mon set en club : les lumières, la foule, le drop.",
    sent: "14 vidéos brutes",
    made: ["Noir et blanc, la couleur par éclats", "Un plan à l’envers", "Des coupes sur le temps"],
  },
  {
    id: "ceramiste",
    trade: "Céramiste",
    brand: "Inès Morel",
    brief: "Une matinée calme à l’atelier, mes mains dans la terre : ça doit donner envie de venir voir mes pièces.",
    sent: "8 vidéos brutes",
    made: ["Une phrase lente, deux mots par plan", "Les mains de tout près", "La lumière du matin"],
  },
  {
    id: "coffee-shop",
    trade: "Coffee shop",
    brand: "Oscar",
    brief: "Bienvenue chez Oscar : le café au calme avant l’ouverture, puis le rush du matin.",
    sent: "16 vidéos brutes",
    made: ["« Bienvenue chez Oscar », mot à mot", "Des fondus pour le calme", "Des coupes vives pour le rush"],
  },
  {
    id: "boxe",
    trade: "Club de boxe",
    brand: "Club Vesta",
    brief: "L’énergie d’un entraînement du soir au club.",
    sent: "12 vidéos brutes",
    made: ["Des passages filés comme un coup", "Un plan en noir et blanc", "Le nom du club en capitales"],
  },
] as const;

/**
 * The Reels of the landing before (lot 6 bis), made by hand on Mixkit clips with Edith's Reel composition: kept only for
 * the trade pages no new Reel fits (hair salon, yoga studio) and the hero scene's demo salon, never shown on the landing.
 */
export const OLDER_WORK = [
  {
    id: "coiffure",
    trade: "Salon de coiffure",
    brand: "Atelier Mèche",
    brief: "Montre tout ce qu’on fait pour une coupe, en vite.",
    sent: "5 vidéos brutes",
    made: ["Un verbe par plan", "Une typo par mot", "Coupes sur le temps"],
  },
  {
    id: "barbier",
    trade: "Barbier",
    brand: "Barbe & Fils",
    brief: "La coupe du jeudi, sans rendez-vous.",
    sent: "5 vidéos brutes",
    made: ["Quatre coins", "Écran partagé titré", "Grotesque très noire"],
  },
  {
    id: "yoga",
    trade: "Studio de yoga",
    brand: "Studio Souffle",
    brief: "Une respiration, rien d’autre.",
    sent: "5 vidéos brutes",
    made: ["Plans fixes de cinéma", "Un mot qui respire", "Lever du soleil"],
  },
] as const;

export type Work = (typeof WORK)[number] | (typeof OLDER_WORK)[number];
export type WorkId = Work["id"];

/** Every Reel of the site, the landing's and the older ones, by id. */
export const workById = (id: WorkId): Work => [...WORK, ...OLDER_WORK].find((w) => w.id === id)!;

/** A Reel of the site by its id: its video, its poster, its small and mini loops. */
export const workMedia = (id: WorkId) => ({
  video: `/landing/reels/${id}.mp4`,
  poster: `/landing/reels/${id}.webp`,
  small: `/landing/reels/${id}-360.mp4`,
  mini: `/landing/reels/${id}-mini.mp4`,
  miniPoster: `/landing/reels/${id}-mini.webp`,
});
