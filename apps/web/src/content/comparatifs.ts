import { DEFAULT_EFFORT, EFFORTS, PLANS } from "@fauve/agent";

// The comparisons (Tristan : « quel strat SEO avoir ? »): few searches, but people ready to choose.
// Fair to the other side: each says when the other choice is the better one. No price of another
// company stated as a fact; only orders of magnitude, said as such.

export type Comparison = {
  slug: string;
  menu: string;
  title: string;
  description: string;
  h1: string;
  accent: string;
  intro: string;
  /** Who is compared, in the table's header. */
  other: string;
  rows: [string, string, string][];
  /** When the other choice is the right one (« Choisis un freelance si… »), and when Edith is. */
  otherChoice: string;
  otherWins: string[];
  edithWins: string[];
  /** Read after both lists. */
  together?: string;
  faq: [string, string][];
};

const Price = `Dès ${PLANS.decouverte.priceEur} € par mois, sans engagement`;
/** How long a Reel takes at the studios' default care, as the app announces it. */
const reelTime = `En général ${EFFORTS[DEFAULT_EFFORT].minutes} minutes`;

export const COMPARISONS: Comparison[] = [
  {
    slug: "community-manager-freelance",
    menu: "Edith ou un community manager freelance",
    title: "Community manager freelance ou IA : que choisir pour un commerce ?",
    description: "Edith ou un community manager freelance : prix, délais, ce que chacun fait vraiment. Une comparaison honnête pour un commerce ou un indépendant.",
    h1: "Edith ou un community manager freelance ?",
    accent: "Une comparaison honnête.",
    intro:
      "Un bon community manager freelance connaît ton quartier, vient filmer, a des idées en te parlant. Edith ne remplace pas tout ça. Il fait autre chose : monter tes vidéos, écrire tes légendes et publier, tout de suite, pour une fraction du prix. Voici ce que chacun fait vraiment.",
    other: "Freelance",
    rows: [
      ["Prix", "Le plus souvent quelques centaines d’euros par mois, selon le volume et la ville", Price],
      ["Délai d’un Reel", "Quelques jours, selon son planning", reelTime],
      ["Tournage", "Peut venir filmer chez toi", "Tu filmes au téléphone, il monte"],
      ["Disponibilité", "Ses horaires, ses vacances", "À toute heure, sur WhatsApp"],
      ["Connaissance de ton commerce", "Excellente, surtout s’il ou elle vient sur place", "Ton site, ce que tu lui dis, ce qu’il retient d’une fois sur l’autre"],
      ["Publication", "Selon ce que vous avez convenu", "Rien ne part sans ton oui"],
      ["Chiffres", "Un bilan selon votre accord", "Un bilan chaque semaine : visites du profil, clics, ce qui a marché"],
    ],
    otherChoice: "Choisis un freelance si…",
    otherWins: [
      "Tu veux quelqu’un qui vienne filmer, photographier, animer tes comptes et répondre à tes messages.",
      "Tu prépares un lancement, une ouverture ou un événement qui demande une vraie campagne.",
      "Tu as le budget, et tu préfères déléguer entièrement, y compris le tournage.",
    ],
    edithWins: [
      "Tu as déjà des vidéos sur ton téléphone, et pas le temps d’en faire des Reels.",
      "Ton budget est de quelques dizaines d’euros par mois, pas de quelques centaines.",
      "Tu veux un Reel aujourd’hui, pas la semaine prochaine.",
    ],
    together: "Les deux se combinent bien : un freelance pour un shooting ou un lancement de temps en temps, Edith pour tenir le rythme entre les deux.",
    faq: [
      ["Un Reel d’Edith est-il aussi bon que celui d’un pro ?", "Il est monté comme un créateur le ferait : la meilleure image en premier, des coupes sur la musique, ta charte, des mots qui ne sentent pas la pub. Ce qu’un pro apporte en plus, c’est le tournage : la qualité de ce que tu filmes compte autant que le montage."],
      ["Edith répond-il aux commentaires et aux messages ?", "Non. Il crée et publie tes Reels, carrousels et légendes ; les échanges avec tes clients restent à toi."],
      ["Combien coûte un community manager freelance ?", "Ça dépend beaucoup du volume, de la ville et de ce qui est compris (tournage, réponses, publicité). Demande plusieurs devis : les écarts sont grands."],
    ],
  },
  {
    slug: "canva-capcut",
    menu: "Edith ou Canva et CapCut",
    title: "Edith ou Canva et CapCut pour les Reels d’un commerce ?",
    description: "Faire ses Reels soi-même avec Canva ou CapCut, ou les confier à Edith ? Temps passé, rendu, modèles, légendes, publication : la comparaison.",
    h1: "Edith ou Canva et CapCut ?",
    accent: "Faire soi-même, ou faire faire.",
    intro:
      "Canva et CapCut sont d’excellents outils, et beaucoup de commerces y font leurs Reels. La question n’est pas l’outil, c’est qui monte : toi, le soir, ou Edith, pendant que tu travailles.",
    other: "Canva / CapCut",
    rows: [
      ["Qui monte", "Toi", "Edith"],
      ["Temps passé", "Le temps de choisir les plans, couper, caler la musique et les textes", "Le temps d’envoyer tes vidéos sur WhatsApp"],
      ["Rendu", "Libre, au pixel près, si tu sais faire", "Monté comme un créateur, à ta charte, sans modèle tout fait"],
      ["Modèles", "Des milliers, partagés par des milliers de comptes", "Aucun : chaque Reel part de tes images"],
      ["Musique", "Leur bibliothèque", "Composée pour chaque Reel, calée sur ses coupes"],
      ["Légende et hashtags", "À écrire toi-même", "Écrits dans ton ton, cinq hashtags au plus"],
      ["Publication", "Tu exportes, puis tu publies", "Publié sur Instagram et TikTok quand tu dis oui"],
      ["Prix", "Gratuits ou avec un abonnement", Price],
    ],
    otherChoice: "Choisis Canva ou CapCut si…",
    otherWins: [
      "Tu aimes monter, tu as le temps, et tu veux décider de chaque image.",
      "Tu fais aussi des affiches, des menus, des cartes de visite : Canva est fait pour ça.",
      "Ton budget est de zéro euro.",
    ],
    edithWins: [
      "Tu n’as ni le temps ni l’envie d’apprendre le montage.",
      "Tu veux des Reels qui ne ressemblent pas au modèle que tout le monde utilise.",
      "Tu veux que la légende, les hashtags et la publication soient faits aussi.",
    ],
    together: "Rien n’empêche de garder Canva pour tes affiches et ton menu, et de laisser les Reels à Edith.",
    faq: [
      ["Je peux modifier ce qu’Edith a fait ?", "Oui : les textes à l’écran, leur taille et leur place, la légende, la couverture. Pour le reste (les coupes, le rythme, la musique), tu lui demandes en mots."],
      ["Je peux télécharger la vidéo ?", "Oui, chaque Reel se télécharge, pour le publier toi-même ou le retoucher ailleurs."],
    ],
  },
  {
    slug: "agence",
    menu: "Edith ou une agence",
    title: "Edith ou une agence de communication pour un commerce ?",
    description: "Agence de communication ou community manager IA : pour quel budget, quels besoins, quels délais ? Ce que chacun fait le mieux pour un commerce de quartier.",
    h1: "Edith ou une agence ?",
    accent: "Pas le même métier.",
    intro:
      "Une agence pense une marque, organise des shootings, lance des campagnes et de la publicité. Edith fait une chose, au quotidien : transformer ce que tu filmes en Reels et en posts soignés, publiés quand tu dis oui.",
    other: "Agence",
    rows: [
      ["Pour quoi faire", "Identité, campagnes, shootings, publicité", "Tes Reels, carrousels et légendes, au quotidien"],
      ["Budget", "Bien plus élevé, souvent avec un engagement", Price],
      ["Délai", "Des jours ou des semaines, avec des allers-retours", `Un Reel : ${reelTime.toLowerCase()}`],
      ["Interlocuteur", "Un chef de projet", "Edith, sur WhatsApp"],
      ["Ton style", "Créé ou retravaillé par l’agence", "Lu sur ton site ou tes images, puis suivi à chaque Reel"],
    ],
    otherChoice: "Choisis une agence si…",
    otherWins: [
      "Tu crées ou refais ton identité : logo, charte, site.",
      "Tu lances un lieu et tu veux une campagne, des photos professionnelles, de la publicité.",
    ],
    edithWins: [
      "Ton identité existe déjà ; il te faut des publications régulières qui la portent.",
      "Tu veux avancer au rythme de ton commerce, sans réunion ni engagement.",
    ],
    together: "Une agence pour poser ta marque, Edith pour la faire vivre chaque semaine : il suit la charte que l’agence a créée.",
    faq: [
      ["Edith fait-il de la publicité payante ?", "Non. Il crée et publie tes publications ; la publicité sponsorisée n’en fait pas partie."],
      ["Il peut suivre la charte de mon agence ?", "Oui : tes couleurs, tes polices (même les tiennes, que tu peux ajouter) et ta direction artistique sont appliquées à chaque Reel."],
    ],
  },
];

export const comparisonBySlug = (slug: string) => COMPARISONS.find((c) => c.slug === slug);
