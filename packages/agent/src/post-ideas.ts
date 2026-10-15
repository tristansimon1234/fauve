// Ideas offered in one tap when the manager starts a post, by format and by the kind of
// business (studios.business_type): a restaurant does not post what a hair salon does.

export type IdeaKind = "reel" | "carousel" | "post" | "story";
type Family = "sport" | "beauty" | "food" | "shop" | "other";

const FAMILIES: [Family, RegExp][] = [
  ["sport", /pilates|yoga|fitness|sport|danse|boxe|gym|salle|crossfit|coach|studio de|natation|escalade|barre/i],
  ["beauty", /coiff|barb|salon|beaut|esth[ée]ti|ongle|manucure|spa|massage|institut|tatou|maquill|cils/i],
  ["food", /restau|caf[ée]|bar\b|brasserie|boulang|p[âa]tiss|pizz|traiteur|bistro|cantine|glac|cr[êe]pe|food|cuisine|vin/i],
  ["shop", /boutique|magasin|fleur|libr|[ée]picerie|cavist|bijou|concept|d[ée]co|mode|v[êe]tement|chaussure|opticien|cadeau/i],
];

const IDEAS: Record<Family, Record<IdeaKind, string[]>> = {
  sport: {
    reel: ["Le cours du jour", "Un exercice en 3 étapes", "Les coulisses avant le cours", "Un prof à l’honneur", "Le cours d’essai"],
    carousel: ["3 erreurs à éviter", "Le planning de la semaine", "Un exercice expliqué", "Un témoignage d’élève", "Les formules"],
    post: ["Un nouveau cours", "L’équipe", "Le cours d’essai", "Une citation qui motive"],
    story: ["Places restantes ce soir", "Sondage : quel cours ?", "Rappel du planning", "Coulisses du jour"],
  },
  beauty: {
    reel: ["Une transformation", "Avant / après", "Le geste d’un pro", "La tendance du moment", "Une offre"],
    carousel: ["3 conseils cheveux", "Les tendances de la saison", "Avant / après", "Un avis client", "Les tarifs"],
    post: ["Une réalisation", "L’équipe", "Un produit chouchou", "Une offre"],
    story: ["Créneaux libres cette semaine", "Sondage : quelle couleur ?", "Coulisses du salon", "Un rappel"],
  },
  food: {
    reel: ["Le plat du jour", "En cuisine", "Le service du soir", "Un produit de saison", "L’équipe"],
    carousel: ["La nouvelle carte", "Les plats de la semaine", "Nos producteurs", "Un avis client", "Le menu du midi"],
    post: ["Le plat du jour", "Un produit de saison", "L’équipe", "Une soirée à venir"],
    story: ["Plus que quelques tables ce soir", "Sondage : quel dessert ?", "Arrivage du jour", "Coulisses en cuisine"],
  },
  shop: {
    reel: ["Les nouveautés", "Un coup de cœur", "Les coulisses de la boutique", "Un conseil", "Une offre"],
    carousel: ["Nos coups de cœur", "Idées cadeaux", "Comment bien choisir", "Un avis client", "Les nouveautés"],
    post: ["Une nouveauté", "Un coup de cœur", "L’équipe", "Une offre"],
    story: ["Arrivage du jour", "Sondage : lequel tu préfères ?", "Dernières pièces", "Horaires de la semaine"],
  },
  other: {
    reel: ["Les coulisses", "Un moment fort", "Une astuce", "Avant / après", "Une offre"],
    carousel: ["3 conseils", "Le planning de la semaine", "Une nouveauté", "Un témoignage", "Les tarifs"],
    post: ["Une nouveauté", "L’équipe", "Une offre", "Une citation"],
    story: ["Places restantes", "Coulisses du jour", "Un sondage", "Un rappel"],
  },
};

/** Three things easy to film this week, with how (« Je n’ai rien sous la main » when she creates a post). */
const FILM: Record<Family, { idea: string; how: string }[]> = {
  sport: [
    { idea: "Un mouvement du cours", how: "De côté, tout le corps dans le cadre." },
    { idea: "Le studio avant le cours", how: "Un tour lent, le téléphone à hauteur d’yeux." },
    { idea: "Un prof qui donne un conseil", how: "Face caméra, dix secondes suffisent." },
  ],
  beauty: [
    { idea: "Tes mains pendant un geste", how: "De près, à côté d’une fenêtre." },
    { idea: "L’avant et l’après d’une cliente", how: "Même endroit, même lumière." },
    { idea: "Ton salon à l’ouverture", how: "Un tour lent, le téléphone à hauteur d’yeux." },
  ],
  food: [
    { idea: "Un plat qui sort de la cuisine", how: "De près, à hauteur d’assiette." },
    { idea: "Un geste en cuisine", how: "Les mains, de près, près d’une lumière." },
    { idea: "La salle avant le service", how: "Un tour lent depuis l’entrée." },
  ],
  shop: [
    { idea: "Une nouveauté qu’on déballe", how: "Sur le comptoir, de près." },
    { idea: "Ta vitrine", how: "Un pas en arrière, puis on avance doucement." },
    { idea: "Un coup de cœur en main", how: "On le tourne lentement devant le téléphone." },
  ],
  other: [
    { idea: "Un geste de ton métier", how: "De près, à côté d’une fenêtre." },
    { idea: "Ton lieu à l’ouverture", how: "Un tour lent, le téléphone à hauteur d’yeux." },
    { idea: "Toi qui donnes un conseil", how: "Face caméra, dix secondes suffisent." },
  ],
};

/** The kind of business a free-text activity belongs to. */
export function businessFamily(businessType: string | null | undefined): Family {
  if (!businessType) return "other";
  return FAMILIES.find(([, re]) => re.test(businessType))?.[0] ?? "other";
}

/** One-tap ideas for each format, for this business. */
export function postIdeas(businessType: string | null | undefined): Record<IdeaKind, string[]> {
  return IDEAS[businessFamily(businessType)];
}

/** Three things easy to film this week, for this business. */
export function filmIdeas(businessType: string | null | undefined): { idea: string; how: string }[] {
  return FILM[businessFamily(businessType)];
}
