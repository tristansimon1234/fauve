// The landing's three Reels (public/landing/work-*.mp4): demo businesses from free stock videos (Mixkit), drawn by
// Edith's Reel composition. Shared by the wall (a client component) and the pages around it.

export const WORK = [
  {
    id: "pilates",
    trade: "Studio de Pilates Reformer",
    brief: "Fais-moi vivre un premier cours. Rien qui fasse pub.",
    sent: "7 vidéos brutes",
    made: ["POV", "Voix off (Victoria)", "Coupes sur le temps"],
  },
  {
    id: "cafe",
    trade: "Café de spécialité",
    brief: "Le premier café du matin, avec un peu d’humour.",
    sent: "6 vidéos brutes",
    made: ["Une chute", "Un plan par temps", "Boîte de texte native"],
  },
  {
    id: "cave",
    trade: "Cave à manger",
    brief: "Donne envie de passer ce soir, sans « réservez maintenant ».",
    sent: "8 vidéos brutes",
    made: ["Voix off (Jules)", "Accroche dès la 1re image", "Grain pellicule"],
  },
] as const;
