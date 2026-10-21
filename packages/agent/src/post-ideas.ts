import { z } from "zod";

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

/**
 * One idea in a tap: a short label on the button, and the request it fills in, written
 * as a manager would write it (how it starts, how it ends, what people should do; with a
 * voice or one message on screen), to show what a good request looks like. Never a fact
 * about the business: hers come from her files and what Simone knows.
 */
export type PostIdea = { label: string; prompt: string };
const idea = (label: string, prompt: string): PostIdea => ({ label, prompt });

const IDEAS: Record<Family, Record<IdeaKind, PostIdea[]>> = {
  sport: {
    reel: [
      idea("Le cours du jour", "Commence par le moment le plus intense du cours, enchaîne 3 ou 4 mouvements, et finis sur tout le groupe. Donne envie de venir essayer."),
      idea("Un exercice en 3 étapes", "Montre un exercice en 3 étapes, une par plan, avec le nom de l’étape à l’écran. Finis en disant de l’enregistrer pour le refaire chez soi."),
      idea("Les coulisses avant le cours", "Raconte avec une voix l’avant-cours : on prépare la salle, les premiers arrivent, on se salue. Finis sur le cours qui commence."),
      idea("Un prof à l’honneur", "Présente un prof avec une voix : son cours, le mouvement qu’il préfère, et quand on peut le retrouver."),
      idea("Le cours d’essai", "Juste un message à l’écran, sans voix : le cours d’essai et comment le réserver. Les plus beaux moments du cours derrière, coupés sur la musique."),
    ],
    carousel: [
      idea("3 erreurs à éviter", "Une erreur par photo, avec la bonne façon de faire en dessous. Sur la dernière, l’invitation à venir corriger ça en cours."),
      idea("Le planning de la semaine", "Le planning de la semaine, un jour par photo avec les cours et les horaires, et comment réserver sur la dernière."),
      idea("Un exercice expliqué", "Un exercice en plusieurs photos : la position, le mouvement, l’erreur à éviter. Finis par « enregistre-le »."),
      idea("Un témoignage d’élève", "Le témoignage d’un élève en quelques mots sur la première photo, ce qui a changé pour lui ensuite, et l’invitation à essayer."),
      idea("Les formules", "Nos formules, une par photo, avec ce qu’elle comprend et pour qui elle est faite. Sur la dernière, comment réserver."),
    ],
    post: [
      idea("Un nouveau cours", "Annonce le nouveau cours : ce qu’on y fait, pour qui, et quand ça commence."),
      idea("L’équipe", "Une photo de l’équipe, avec une phrase sur chacun dans la légende."),
      idea("Le cours d’essai", "Le cours d’essai sur une belle photo du cours, et comment le réserver."),
      idea("Une citation qui motive", "Une phrase qui motive, posée sur une photo du studio."),
    ],
    story: [
      idea("Places restantes ce soir", "Il reste des places ce soir : le cours, l’heure, et comment réserver."),
      idea("Sondage : quel cours ?", "Un sondage pour choisir le prochain cours à ajouter."),
      idea("Rappel du planning", "Le planning de demain en une image simple à lire."),
      idea("Coulisses du jour", "Une coulisse du jour en une image, avec une petite phrase."),
    ],
  },
  beauty: {
    reel: [
      idea("Une transformation", "Commence par le résultat une seconde, reviens à l’avant, puis les étapes en accéléré. Finis sur le résultat et l’invitation à prendre rendez-vous."),
      idea("Avant / après", "Avant / après sans voix : l’avant, un geste, l’après. Un seul message à l’écran avec la prestation et comment réserver."),
      idea("Le geste d’un pro", "Montre un geste de près, au ralenti, et raconte avec une voix pourquoi on le fait comme ça. Finis sur le résultat."),
      idea("La tendance du moment", "La tendance de la saison sur nos clientes, une par plan, et finis en invitant à venir l’essayer."),
      idea("Une offre", "Juste un message à l’écran, sans voix : l’offre du moment et jusqu’à quand. Nos plus belles réalisations derrière."),
    ],
    carousel: [
      idea("3 conseils cheveux", "Un conseil par photo, simple à appliquer chez soi, et sur la dernière l’invitation à prendre rendez-vous."),
      idea("Les tendances de la saison", "Une tendance par photo, avec un mot sur pour qui elle est faite. Finis par « laquelle tu tenterais ? »."),
      idea("Avant / après", "L’avant sur la première photo, l’après sur la deuxième, puis un détail du résultat. La prestation et comment réserver sur la dernière."),
      idea("Un avis client", "L’avis d’une cliente en quelques mots sur sa photo, puis le résultat, et comment réserver."),
      idea("Les tarifs", "Nos tarifs, une prestation par photo avec ce qui est compris, et comment réserver sur la dernière."),
    ],
    post: [
      idea("Une réalisation", "Notre plus belle réalisation de la semaine, avec la prestation dans la légende."),
      idea("L’équipe", "Une photo de l’équipe, avec une phrase sur chacun dans la légende."),
      idea("Un produit chouchou", "Le produit qu’on adore, en main, avec pourquoi en une phrase."),
      idea("Une offre", "L’offre du moment sur une belle photo, avec jusqu’à quand et comment en profiter."),
    ],
    story: [
      idea("Créneaux libres cette semaine", "Les créneaux encore libres cette semaine, et comment réserver."),
      idea("Sondage : quelle couleur ?", "Un sondage entre deux couleurs ou deux coupes."),
      idea("Coulisses du salon", "Une coulisse du salon en une image, avec une petite phrase."),
      idea("Un rappel", "Un rappel simple : les horaires, l’adresse ou un rendez-vous à prendre."),
    ],
  },
  food: {
    reel: [
      idea("Le plat du jour", "Commence par le plat qui arrive sur la table, montre comment on le prépare, et finis sur la première bouchée. Dis qu’on le sert aujourd’hui."),
      idea("En cuisine", "Raconte avec une voix un service en cuisine : les gestes, le feu, l’assiette qui part. Finis sur la salle et l’invitation à réserver."),
      idea("Le service du soir", "Ouvre sur la salle pleine, puis les plats qui sortent l’un après l’autre, et finis sur une table qui trinque. Donne envie de réserver ce soir."),
      idea("Un produit de saison", "Montre le produit brut, puis le plat qu’on en fait, et raconte d’où il vient. Finis en disant jusqu’à quand il est à la carte."),
      idea("L’équipe", "Présente l’équipe, un plan par personne avec ce que chacun fait, et finis tous ensemble."),
    ],
    carousel: [
      idea("La nouvelle carte", "Un plat par photo avec son nom et ce qu’il y a dedans. Sur la dernière, comment réserver."),
      idea("Les plats de la semaine", "Un plat par jour de la semaine, une photo chacun, et comment réserver sur la dernière."),
      idea("Nos producteurs", "Un producteur par photo, ce qu’il nous apporte et d’où il vient."),
      idea("Un avis client", "L’avis d’un client sur la photo de son plat, puis la salle, et l’invitation à venir."),
      idea("Le menu du midi", "Le menu du midi : l’entrée, le plat, le dessert, une photo chacun, et le prix sur la dernière."),
    ],
    post: [
      idea("Le plat du jour", "Le plat du jour en gros plan, avec ce qu’il y a dedans dans la légende."),
      idea("Un produit de saison", "Le produit de saison et le plat qu’on en fait, racontés dans la légende."),
      idea("L’équipe", "Une photo de l’équipe, avec une phrase sur chacun dans la légende."),
      idea("Une soirée à venir", "Annonce la soirée : quand, ce qui s’y passe, et comment réserver."),
    ],
    story: [
      idea("Plus que quelques tables ce soir", "Il reste quelques tables ce soir : l’heure, et comment réserver."),
      idea("Sondage : quel dessert ?", "Un sondage entre deux desserts."),
      idea("Arrivage du jour", "L’arrivage du jour en une image, avec une petite phrase."),
      idea("Coulisses en cuisine", "Une coulisse en cuisine en une image, avec une petite phrase."),
    ],
  },
  shop: {
    reel: [
      idea("Les nouveautés", "Montre les nouveautés une par une, de près, et finis sur la vitrine avec l’invitation à passer les voir."),
      idea("Un coup de cœur", "Raconte avec une voix pourquoi on adore ce produit : de près, en main, puis porté ou utilisé. Finis sur où le trouver."),
      idea("Les coulisses de la boutique", "Montre l’ouverture de la boutique : on installe, on range, on accueille. Finis sur la porte qui s’ouvre."),
      idea("Un conseil", "Un conseil pour bien choisir en 3 plans, avec le conseil à l’écran. Finis en disant de l’envoyer à quelqu’un qui en a besoin."),
      idea("Une offre", "Juste un message à l’écran, sans voix : l’offre et jusqu’à quand. Nos plus beaux produits derrière."),
    ],
    carousel: [
      idea("Nos coups de cœur", "Un coup de cœur par photo, avec pourquoi on l’aime, et où le trouver sur la dernière."),
      idea("Idées cadeaux", "Une idée cadeau par photo, pour qui et à quel prix. Finis par « identifie la personne à qui tu l’offrirais »."),
      idea("Comment bien choisir", "Les étapes pour bien choisir, une par photo, et l’invitation à venir se faire conseiller."),
      idea("Un avis client", "L’avis d’un client avec le produit qu’il a choisi, et l’invitation à passer."),
      idea("Les nouveautés", "Une nouveauté par photo, avec son nom et son prix."),
    ],
    post: [
      idea("Une nouveauté", "La nouveauté de la semaine, avec le prix dans la légende."),
      idea("Un coup de cœur", "Notre coup de cœur, en main, avec pourquoi en une phrase."),
      idea("L’équipe", "Une photo de l’équipe, avec une phrase sur chacun dans la légende."),
      idea("Une offre", "L’offre du moment sur une belle photo, avec jusqu’à quand et comment en profiter."),
    ],
    story: [
      idea("Arrivage du jour", "L’arrivage du jour en une image, avec une petite phrase."),
      idea("Sondage : lequel tu préfères ?", "Un sondage entre deux produits."),
      idea("Dernières pièces", "Les dernières pièces disponibles, en une image."),
      idea("Horaires de la semaine", "Les horaires de la semaine en une image simple à lire."),
    ],
  },
  other: {
    reel: [
      idea("Les coulisses", "Montre ce qu’on ne voit jamais : la préparation, les gestes, l’équipe. Finis sur le résultat et l’invitation à venir."),
      idea("Un moment fort", "Ouvre sur le meilleur moment, puis ce qui l’a précédé, et finis dessus avec l’invitation à venir le vivre."),
      idea("Une astuce", "Une astuce en 3 étapes, une par plan, avec l’étape à l’écran. Finis en disant de l’enregistrer."),
      idea("Avant / après", "Avant / après sans voix : l’avant, le geste, l’après, avec un seul message à l’écran."),
      idea("Une offre", "Juste un message à l’écran, sans voix : l’offre et jusqu’à quand. Nos plus belles images derrière."),
    ],
    carousel: [
      idea("3 conseils", "Un conseil par photo, simple à appliquer, et sur la dernière l’invitation à venir."),
      idea("Le planning de la semaine", "Le planning de la semaine, un jour par photo, et comment réserver sur la dernière."),
      idea("Une nouveauté", "La nouveauté en plusieurs photos : ce que c’est, pour qui, et à partir de quand."),
      idea("Un témoignage", "Le témoignage d’un client sur sa photo, puis ce qu’on a fait pour lui, et l’invitation à venir."),
      idea("Les tarifs", "Nos tarifs, une prestation par photo, et comment réserver sur la dernière."),
    ],
    post: [
      idea("Une nouveauté", "La nouveauté, avec ce qu’il faut savoir dans la légende."),
      idea("L’équipe", "Une photo de l’équipe, avec une phrase sur chacun dans la légende."),
      idea("Une offre", "L’offre du moment sur une belle photo, avec jusqu’à quand et comment en profiter."),
      idea("Une citation", "Une phrase qui nous ressemble, posée sur une photo du lieu."),
    ],
    story: [
      idea("Places restantes", "Les places encore libres, et comment réserver."),
      idea("Coulisses du jour", "Une coulisse du jour en une image, avec une petite phrase."),
      idea("Un sondage", "Un sondage simple pour connaître l’avis de tes abonnés."),
      idea("Un rappel", "Un rappel simple : les horaires, l’adresse ou un rendez-vous à prendre."),
    ],
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
export function postIdeas(businessType: string | null | undefined): Record<IdeaKind, PostIdea[]> {
  return IDEAS[businessFamily(businessType)];
}

/** Three things easy to film this week, for this business. */
export function filmIdeas(businessType: string | null | undefined): { idea: string; how: string }[] {
  return FILM[businessFamily(businessType)];
}

// The last step of « Créer » (Tristan : « la dernière étape doit être dynamique, une
// proposition ») : once her files are picked, Simone looks at them and proposes what she
// would make of them, in three requests written as the manager would write them; a tap
// fills them in, she can change them. The ideas above are only the fallback.

export const PROPOSAL_PROMPT = `Tu es Simone, la community manager d'un commerce de quartier, avec l'œil d'un bon créateur de contenu. La gérante vient de choisir ses photos et vidéos pour une publication. Propose-lui 3 idées de ce que tu en ferais, pour qu'elle en touche une : celles d'un pro qui a regardé ses fichiers, pas des idées qui iraient à n'importe quel commerce.

Chaque idée :
- label : 2 à 5 mots, ce que c'est (« Le geste puis le résultat », « Elle raconte sa matinée »), jamais une phrase de pub ;
- prompt : la demande entière, écrite comme la gérante l'écrirait elle-même, à la première personne, en 2 ou 3 phrases simples : par quel plan précis commencer (ce qui arrête le pouce dans la 1re seconde), l'ordre de ce qu'on voit, comment finir, ce que les gens doivent faire (venir, réserver, enregistrer, envoyer à quelqu'un) ; pour un Reel, avec une voix qui raconte, ses propres paroles, ou juste un message à l'écran.

Regarde vraiment ses fichiers (« fichiers_dans_l_ordre » : leurs plans, leurs meilleurs passages, ce qu'on y dit, et les photos ci-dessous) : chaque idée nomme des plans précis qui y sont (« la vidéo où elle ajuste le reformer », « la photo de la vitrine le soir »), jamais une image qui n'y est pas. Quand quelqu'un parle dans une vidéo, une idée au moins se construit sur ce qu'il dit, avec ses mots (et sans voix off par-dessus). Trois idées vraiment différentes : un angle et une forme chacune (raconté par une voix, ses propres paroles face caméra, un seul message clé posé sur de beaux plans, une visite en point de vue, le geste puis le résultat, avant / après, les coulisses, un mini-tuto…), jamais trois variantes du même Reel. Quand elle a dit ce qu'elle imagine (« publication.ce_qu_elle_imagine »), les trois idées sont trois façons concrètes de faire SON idée : son message, son intention et ce qu'elle a demandé restent, tu les précises avec ses vrais plans (l'ouverture, l'ordre, la fin, la forme) ; jamais une autre idée à la place de la sienne. Quand elle recopie un Reel qu'elle aime (« reel_a_recopier »), les trois idées suivent sa forme et changent le fond. Ne refais pas ses publications récentes (« publications_recentes »). Respecte son choix de voix s'il est donné, et sa direction artistique.

Rien d'inventé sur le commerce : ni prix, ni horaire, ni offre, ni nom, ni avis ; seulement ce que montrent ses fichiers et ce qu'on sait du commerce. Native et vraie, jamais une pub ni un flyer. Le but : des clients, pas du buzz. Tutoiement, français simple, sans tiret long.`;

export const proposalSchema = z.object({
  ideas: z
    .array(
      z.object({
        label: z.string().describe("2 à 5 mots"),
        prompt: z.string().describe("La demande entière, comme elle l'écrirait, 1 à 3 phrases"),
      }),
    )
    .describe("3 idées différentes"),
});
export type Proposal = z.infer<typeof proposalSchema>;

/** The proposals as shown: 3 at most, short labels, requests that fit « Ce que tu imagines » (500 characters). */
export function keptProposals(p: Proposal | null | undefined): PostIdea[] {
  const cut = (text: string, max: number) => {
    const flat = text.replace(/\s+/g, " ").replace(/\s*—\s*/g, ", ").trim();
    return flat.length <= max ? flat : `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
  };
  return (p?.ideas ?? [])
    .map((i) => ({ label: cut(i.label, 40), prompt: cut(i.prompt, 480) }))
    .filter((i) => i.label && i.prompt.length >= 20)
    .slice(0, 3);
}
