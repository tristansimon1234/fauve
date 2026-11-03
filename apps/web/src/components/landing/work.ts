// The site's Reels (public/landing/reels): demo businesses, each a different form, made on free stock clips (Mixkit) by
// Edith's Reel composition with music Edith composed, cut on its beats (lot 6 bis, Tristan: « il faut carrément des
// nouveaux réels »). Shared by the wall (a client component) and the pages around it. raw-<id>-<k>.webp: three of the
// clips each one was made from.

export const WORK = [
  {
    id: "coiffure",
    trade: "Salon de coiffure",
    brand: "Atelier Mèche",
    brief: "Montre tout ce qu’on fait pour une coupe, en vite.",
    sent: "5 vidéos brutes",
    made: ["Un verbe par plan", "Une typo par mot", "Coupes sur le temps"],
  },
  {
    id: "fleuriste",
    trade: "Fleuriste",
    brief: "L’arrivage du lundi, un peu comme un carnet.",
    brand: "Pivoine",
    sent: "6 vidéos brutes",
    made: ["Tirages posés sur la table", "Écrit à la main", "Fenêtre qui s’ouvre"],
  },
  {
    id: "bar",
    trade: "Bar à cocktails",
    brief: "Le jeudi soir, en noir et blanc, avec du rouge.",
    brand: "Le Comptoir",
    sent: "7 vidéos brutes",
    made: ["Un mot qui claque par coupe", "Noir et blanc, un trait de rouge", "Cinq polices"],
  },
  {
    id: "ceramique",
    trade: "Atelier de céramique",
    brief: "Ça doit respirer la lenteur.",
    brand: "Terre Lente",
    sent: "6 vidéos brutes",
    made: ["Une lettre par coupe", "Étiquettes techniques", "Grain argile"],
  },
  {
    id: "cafe",
    trade: "Café",
    brief: "Le premier café, avec un effet qui surprend.",
    brand: "Café Tolbiac",
    sent: "5 vidéos brutes",
    made: ["Un mot qu’on traverse", "Titre qui se décode", "Écrit à la machine"],
  },
  {
    id: "patisserie",
    trade: "Boulangerie",
    brief: "Six heures du matin, ça grouille.",
    brand: "Maison Farine",
    sent: "7 vidéos brutes",
    made: ["Mosaïque qui ne s’arrête jamais", "Une case par temps", "Titre en relief"],
  },
  {
    id: "tatoueur",
    trade: "Tatoueur",
    brief: "Sobre, noir, technique. Pas de flammes.",
    brand: "Encre Noire",
    sent: "5 vidéos brutes",
    made: ["Une fenêtre qui voyage", "Étiquettes tapées", "Titre qui se décode"],
  },
  {
    id: "barbier",
    trade: "Barbier",
    brief: "La coupe du jeudi, sans rendez-vous.",
    brand: "Barbe & Fils",
    sent: "5 vidéos brutes",
    made: ["Quatre coins", "Écran partagé titré", "Grotesque très noire"],
  },
  {
    id: "yoga",
    trade: "Studio de yoga",
    brief: "Une respiration, rien d’autre.",
    brand: "Studio Souffle",
    sent: "5 vidéos brutes",
    made: ["Plans fixes de cinéma", "Un mot qui respire", "Lever du soleil"],
  },
] as const;

export type WorkId = (typeof WORK)[number]["id"];

/** A Reel of the site by its id: its video, its poster, its small and mini loops. */
export const workMedia = (id: WorkId) => ({
  video: `/landing/reels/${id}.mp4`,
  poster: `/landing/reels/${id}.webp`,
  small: `/landing/reels/${id}-360.mp4`,
  mini: `/landing/reels/${id}-mini.mp4`,
  miniPoster: `/landing/reels/${id}-mini.webp`,
});
