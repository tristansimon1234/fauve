// The guides (Tristan : « quel strat SEO avoir ? »): what owners search before they buy anything
// (« idées de Reels restaurant », « légende Instagram »…), answered properly, by hand, two a month.
// Each one says what Edith's rules say (caption.ts, the editor's quality bar): the site never
// teaches what the product does not do. Never written in bulk by a model.

export type Block =
  | { h2: string }
  | { p: string }
  | { ul: string[] }
  /** A numbered list; `start` carries the count on from an earlier list (« 15 idées » over several sections). */
  | { ol: [string, string][]; start?: number }
  | { tip: string }
  | { example: { label: string; text: string } };

export type Guide = {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  h1: string;
  accent?: string;
  /** ISO date of publication, and of the last real change. */
  published: string;
  updated?: string;
  minutes: number;
  intro: string;
  blocks: Block[];
  /** The trade page it leads to. */
  trade: string;
};

export const GUIDES: Guide[] = [
  {
    slug: "idees-reels-restaurant",
    title: "15 idées de Reels pour un restaurant (qui donnent faim)",
    description: "15 idées de Reels faciles à filmer pour un restaurant, un café ou un bar : en cuisine, en salle, avec l’équipe. Et comment filmer vite.",
    kicker: "Restaurant",
    h1: "15 idées de Reels pour un restaurant",
    accent: "qui donnent faim, pas qui font pub.",
    published: "2026-10-28",
    minutes: 7,
    intro:
      "Un bon Reel de restaurant ne vend rien. Il montre une assiette qui arrive, un geste, une salle qui se remplit, et quelqu’un qui scrolle a soudain envie d’y être ce soir. Voici quinze idées qui marchent pour un restaurant, un café ou un bar, toutes filmables au téléphone en quelques secondes.",
    blocks: [
      { h2: "Avant les idées : trois règles" },
      {
        ol: [
          ["La première seconde décide tout.", "Ouvre sur le plat, le geste ou le résultat, jamais sur ta façade ni ton logo. On décide de rester avant d’avoir lu quoi que ce soit."],
          ["Des plans courts, sur la musique.", "Un plan toutes les une à deux secondes, coupé sur le temps. Un plan de cinq secondes sur une assiette immobile, c’est là qu’on décroche."],
          ["Une raison de venir, pas un slogan.", "« Ce soir à la carte », « jusqu’à dimanche », « le midi seulement » : un fait concret plutôt que « réservez vite »."],
        ],
      },
      { h2: "En cuisine" },
      {
        ol: [
          ["Le plat du jour, du feu à l’assiette.", "Trois plans : la cuisson, le dressage, l’assiette qui part. Finis sur la première bouchée en salle."],
          ["Un geste en gros plan.", "La pâte qu’on étire, la sauce qu’on nappe, le chalumeau sur la crème. Filmé de près, avec la lumière d’une fenêtre."],
          ["Le produit brut, puis le plat.", "La caisse de tomates qui arrive le matin, puis l’assiette du soir. Dis d’où elles viennent."],
          ["La mise en place.", "Tout ce qu’on prépare avant le service, en accéléré. Les gens adorent voir l’envers du décor."],
          ["Le chef qui goûte.", "Une cuillère, un regard, un geste pour rectifier. Dix secondes, et ton restaurant a un visage."],
        ],
      },
      { h2: "En salle" },
      {
        start: 6,
        ol: [
          ["La salle qui se remplit.", "Le même plan, filmé à 18 h, 19 h et 20 h. Pas besoin de texte : on comprend tout seul."],
          ["POV : ta table du vendredi soir.", "Filmé à hauteur de convive, les plats qui arrivent l’un après l’autre. La forme « pov : » est faite pour ça."],
          ["Le service vu du passe.", "Les assiettes qui partent, les mains qui attrapent, le rythme. Coupé sur la musique, c’est hypnotique."],
          ["Le verre qu’on sert.", "Un vin qu’on verse, un cocktail qu’on monte, un café qui coule. Le son compte autant que l’image."],
          ["Les habitués.", "Avec leur accord, ceux qui viennent depuis des années. Rien ne rassure plus quelqu’un qui ne connaît pas encore."],
        ],
      },
      { h2: "Les gens derrière" },
      {
        start: 11,
        ol: [
          ["L’équipe, un plan chacun.", "Un prénom, un poste, un geste. Finis sur tout le monde ensemble."],
          ["Le producteur.", "Le fromager, le maraîcher, le caviste : d’où vient ce qu’on mange chez toi, et pourquoi tu l’as choisi."],
          ["La question qu’on vous pose le plus.", "« C’est quoi, une cave à manger ? », « Vous faites sans gluten ? » Une vraie question, une réponse courte, en voix off."],
        ],
      },
      { h2: "Pour faire venir, sans faire pub" },
      {
        start: 14,
        ol: [
          ["La carte qui change.", "Un plat par plan, son nom à l’écran, et la date à partir de laquelle il est servi."],
          ["Le moment à ne pas rater.", "Le brunch du dimanche, la soirée du jeudi, le plat de saison qui part en deux semaines. Montre-le en vrai, dis jusqu’à quand."],
        ],
      },
      { tip: "Une seule idée par Reel. Un Reel qui montre la cuisine, la salle, l’équipe et la carte ne raconte plus rien." },
      { h2: "Filmer sans y passer ta soirée" },
      {
        ul: [
          "Filme près d’une fenêtre ou sous une lumière chaude ; évite les néons droit au-dessus de l’assiette.",
          "Tiens le téléphone à hauteur d’assiette, en vertical, et bouge lentement.",
          "Dix secondes par plan suffisent : tu couperas au montage.",
          "Filme plus que nécessaire : trois prises du même geste, c’est le choix entre un Reel moyen et un bon.",
          "Garde le son : le grésillement, le verre qu’on remplit, la salle qui parle. Il fait partie du Reel.",
        ],
      },
      { h2: "Ce qui fait fuir" },
      {
        ul: [
          "« Découvrez notre nouvelle carte ! » en grosses lettres : c’est une pub, on la passe.",
          "Un texte posé sur le visage de quelqu’un.",
          "Des transitions qui tournent, des flashs, des effets à chaque plan.",
          "Trente hashtags sous la légende : Instagram n’en compte plus que cinq.",
          "Un prix, un horaire ou un avis inventé pour faire joli.",
        ],
      },
      {
        p: "Avec Edith, tu envoies tes vidéos sur WhatsApp telles quelles : il choisit les plans, les coupe sur la musique, trouve l’accroche, écrit la légende et te le donne prêt à poster. Tu peux lui demander n’importe laquelle de ces idées avec tes mots.",
      },
    ],
    trade: "restaurant",
  },
  {
    slug: "legende-instagram-commerce",
    title: "Légende Instagram : comment l’écrire pour un commerce (exemples)",
    description: "Écrire une légende Instagram qui fait venir des clients : l’accroche, le détail vrai, l’appel concret, 5 hashtags au plus. Exemples avant / après.",
    kicker: "Légendes",
    h1: "Écrire une légende Instagram",
    accent: "quand on a un commerce.",
    published: "2026-10-28",
    minutes: 6,
    intro:
      "La légende ne sert pas à décrire ce qu’on voit : on le voit déjà. Elle sert à donner une raison de rester, d’enregistrer, d’envoyer à quelqu’un, et surtout de venir. Voici comment l’écrire en trois temps, ce que les commerces oublient presque tous, et ce qui fait « écrit par une IA » au premier coup d’œil.",
    blocks: [
      { h2: "La structure en trois temps" },
      {
        ol: [
          ["Une première ligne qui accroche.", "C’est tout ce qu’on lit avant le « … plus ». Quatre-vingts caractères au maximum, et une seule idée : une question, un fait surprenant, une promesse précise."],
          ["Une ou deux lignes utiles.", "Le détail vrai que la vidéo ne dit pas : d’où vient le produit, combien de temps ça prend, pour qui c’est fait."],
          ["Un appel concret.", "Ce que la personne doit faire, et quand : « réserve par le lien en bio », « on t’attend samedi dès 10 h », « envoie-le à celle qui… »."],
        ],
      },
      { p: "Au total, trois cents caractères suffisent la plupart du temps. Une légende courte et aérée se lit en entier ; un pavé se saute." },
      { h2: "Dis qui tu es, et où" },
      {
        p: "Instagram et TikTok lisent la légende pour montrer ta publication aux gens qui cherchent près de chez eux. Écris ton métier, ton quartier et ta ville en toutes lettres, comme tu le dirais à quelqu’un : « coiffeuse à la Croix-Rousse, à Lyon », « cave à manger dans le Marais ». C’est l’oubli le plus fréquent, et le plus simple à corriger.",
      },
      { h2: "Donne une raison de l’envoyer" },
      {
        p: "Une publication enregistrée ou partagée vaut plus qu’un like. Un conseil qu’on veut garder, une question à laquelle on a envie de répondre en commentaire, un « à envoyer à quelqu’un qui… » bien trouvé. Sans forcer : une raison par légende, et seulement si elle est vraie.",
      },
      { h2: "Les hashtags : cinq au plus" },
      {
        p: "Instagram ne prend plus en compte que cinq hashtags par publication, ceux de la légende compris. Choisis-en trois à cinq qui décrivent vraiment ton post et ton quartier, plutôt qu’un mur de trente mots-clés génériques.",
      },
      { h2: "Ce qui fait « écrit par une IA »" },
      {
        ul: [
          "Le tiret long (—) au milieu des phrases.",
          "« N’hésitez pas », « plongez dans l’univers », « véritable », « incontournable », « sublimer ».",
          "« Que vous soyez… ou… », « dans un monde où… ».",
          "Trois adjectifs à la suite : « un lieu chaleureux, authentique et convivial ».",
          "Un emoji au début de chaque ligne.",
        ],
      },
      { tip: "Le test le plus simple : relis ta légende à voix haute. Si tu ne la dirais pas comme ça à un client au comptoir, réécris-la." },
      { h2: "Trois exemples, avant et après" },
      {
        example: {
          label: "Restaurant · avant",
          text: "✨ Découvrez notre nouvelle carte d’automne ! Une cuisine authentique, généreuse et créative qui saura sublimer vos papilles. N’hésitez pas à réserver ! 🍂🍷 #restaurant #food #foodporn #instafood #paris #yummy …",
        },
      },
      {
        example: {
          label: "Restaurant · après",
          text: "Les cèpes sont arrivés ce matin de Corrèze.\nRisotto aux cèpes et parmesan affiné 24 mois, à la carte jusqu’à ce qu’il n’y en ait plus.\nTable par le lien en bio, ou passe au comptoir.\n#restaurantparis #paris11 #cepes",
        },
      },
      {
        example: {
          label: "Salon de coiffure · après",
          text: "Trois heures pour ce blond, et chaque minute se voit.\nBalayage à main levée, patine froide, coupe dégradée. Le résultat de dos à la fin.\nRendez-vous par le lien en bio. Salon de coiffure à Nantes, quartier Graslin.\n#coiffeurnantes #balayage #blondfroid",
        },
      },
      {
        example: {
          label: "Studio de Pilates · après",
          text: "Personne ne réussit ça au premier cours. Personne.\nLe teaser au Reformer, en trois étapes, pour le travailler sans se faire mal.\nEnregistre-le, et viens l’essayer en vrai : cours d’essai par le lien en bio.\n#pilatesbordeaux #reformer #pilates",
        },
      },
      { p: "Les exemples sont inventés pour l’article : chez toi, chaque détail doit être vrai. Un prix, un horaire ou un avis qu’on invente se paie toujours plus cher qu’une légende un peu simple." },
      {
        p: "Edith écrit chaque légende selon ces règles, dans ton ton, avec ton métier et ton quartier quand il les connaît, et n’invente jamais un fait. Tu peux toujours la réécrire avant de publier.",
      },
    ],
    trade: "restaurant",
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);

/** A publication date in words, as the guides show it (« 28 octobre 2026 »). */
export const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/**
 * The next guides, two a month, in the order they should come (search volume first, then the trades
 * still without one). Written by hand, then moved into GUIDES.
 */
export const NEXT_GUIDES = [
  "Quoi poster sur l’Instagram d’un salon de coiffure (30 idées)",
  "À quelle heure publier ? Comment trouver la tienne avec tes propres chiffres",
  "Faire un Reel avec son téléphone : lumière, cadrage, son",
  "Idées de Reels pour un studio de Pilates ou de yoga",
  "Combien coûte un community manager pour un commerce en 2026 ?",
  "Story Instagram avec un lien : comment faire réserver",
  "Carrousel Instagram : la couverture et la 2e image qui font tout",
  "Instagram ou TikTok pour un commerce de quartier ?",
  "Idées de posts pour une boutique (sans faire promo toute l’année)",
  "Comment savoir si Instagram t’amène des clients",
];
