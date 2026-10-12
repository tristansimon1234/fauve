import type { PostKind, PostStatus } from "@mila/agent";

// Demo content from the mockup ("Studio Lune"), used until the screens read Supabase.

export const gradients = {
  peach: "linear-gradient(160deg,#F6C9B8,#C86B5A)",
  lilac: "linear-gradient(160deg,#D9CCF5,#7A5FD6)",
  apricot: "linear-gradient(160deg,#F7DEC4,#D9905A)",
  rose: "linear-gradient(160deg,#E9C6D6,#A0577A)",
  sage: "linear-gradient(160deg,#CFE0D9,#5F8F80)",
} as const;

export const demoStudio = {
  name: "Studio Lune",
  initials: "SL",
  manager: "Camille",
  instagram: "studio.lune",
  tiktok: "studiolune",
  postsPerWeek: 3,
  storiesPerWeek: 4,
};

export type DemoPost = {
  id: string;
  kind: PostKind;
  title: string;
  /** 0 = Monday 12 October 2026. */
  day: number;
  time: string;
  status: PostStatus;
  thumb?: string;
};

export const demoWeek = { label: "Semaine du 12 au 18 octobre", firstDay: 12 };

export const demoPosts: DemoPost[] = [
  { id: "planning-semaine", day: 0, kind: "story", time: "9:00", title: "Le planning de la semaine", status: "published", thumb: gradients.lilac },
  { id: "bienfaits-reformer", day: 1, kind: "carousel", time: "12:30", title: "Les 3 bienfaits du reformer", status: "published", thumb: gradients.apricot },
  { id: "dernieres-places", day: 2, kind: "story", time: "18:30", title: "Dernières places jeudi 7 h", status: "validated", thumb: gradients.rose },
  { id: "studio-se-reveille", day: 3, kind: "reel", time: "18:00", title: "Le studio se réveille", status: "draft", thumb: gradients.peach },
  { id: "portrait-ines", day: 4, kind: "post", time: "12:00", title: "Portrait : Inès, nouvelle prof", status: "content_requested" },
  { id: "atelier-prenatal", day: 5, kind: "story", time: "10:00", title: "Atelier prénatal du 26/10", status: "planned" },
  { id: "coulisses-samedi", day: 5, kind: "story", time: "17:00", title: "Coulisses du samedi", status: "content_requested" },
];

export const demoShots = [
  { label: "Les mains sur la barre, en gros plan", hint: "Pour le Reel de jeudi · lumière du matin", done: true },
  { label: "Inès qui corrige une posture", hint: "Pour son portrait de vendredi · de profil", done: false },
  { label: "Le studio vide avant le premier cours", hint: "Pour les stories · 5 secondes suffisent", done: false },
];

export const demoDraft = {
  id: "studio-se-reveille",
  title: "Le studio se réveille",
  subtitle: "Reel · jeudi 15 octobre à 18 h · préparé par Mila à partir de tes 5 vidéos",
  hook: ["6 h 45.", "Le studio", "se réveille."],
  band: "les premières à la barre",
  caption:
    "6 h 45, les premières à la barre. Il reste 2 places au cours de jeudi 7 h, on vous garde un reformer ? Réservation en bio.",
  hashtags: ["pilatesreformer", "paris5", "pilatesparis", "studiolune"],
  slots: ["Jeudi 15 oct. · 18:00 (conseillé)", "Jeudi 15 oct. · 12:30", "Mercredi 14 oct. · 19:00"],
  duration: 12,
  keptShots: "3 plans gardés sur 5",
  segments: [
    { label: "Mains · barre", weight: 3, bg: gradients.peach },
    { label: "Correction", weight: 4, bg: gradients.lilac },
    { label: "Studio au lever du jour", weight: 5, bg: gradients.apricot },
  ],
  timeline: [
    ["0–2,5 s", "Accroche « 6 h 45. Le studio se réveille. »"],
    ["2,5–9 s", "Sous-titres mot à mot"],
    ["9–12 s", "Logo + « 2 places jeudi 7 h »"],
  ],
  milaNote:
    "J’ai mis les mains en premier : sur tes 6 derniers Reels, ceux qui commencent par un gros plan ont été regardés plus longtemps. J’ai écarté le plan 4, trop sombre.",
};

export const demoClips = [
  { duration: "0:08", bg: gradients.peach },
  { duration: "0:14", bg: gradients.lilac },
  { duration: "0:06", bg: gradients.apricot },
  { duration: "0:11", bg: gradients.rose },
  { duration: "0:09", bg: gradients.sage },
];

export const demoConversations = [
  "Reel du cours de mardi",
  "Bilan de la semaine 41",
  "Atelier prénatal du 26/10",
  "Idées de tournage octobre",
  "Légende pour la nouvelle prof",
  "Réponse au message de Léa",
  "Post « places restantes »",
  "Mise en place de Mila",
];

export const demoResults = {
  "7": {
    kpis: [
      ["Réservations venues d’Instagram", "3", "+1 vs semaine précédente"],
      ["Visites du profil", "310", "+9 %"],
      ["Comptes touchés", "3 200", "+12 %"],
      ["Nouveaux abonnés", "+21", "+5 vs semaine précédente"],
    ],
    bilan:
      "Semaine régulière : 3 posts publiés comme prévu. Le carrousel sur les bienfaits du reformer a été beaucoup enregistré, signe qu’il intéresse des futurs élèves.",
  },
  "30": {
    kpis: [
      ["Réservations venues d’Instagram", "9", "+4 vs mois précédent"],
      ["Visites du profil", "1 120", "+18 %"],
      ["Comptes touchés", "12 400", "+31 %"],
      ["Nouveaux abonnés", "+86", "+22 vs mois précédent"],
    ],
    bilan:
      "Bon mois : les Reels avec un gros plan dès la première seconde ont été vus jusqu’au bout deux fois plus souvent que les autres. Les stories « dernières places » ont amené 4 réservations à elles seules.",
  },
} as const;

export const demoSuggestions = [
  "2 Reels avec un gros plan en ouverture",
  "Le portrait d’Inès vendredi midi",
  "Moins de carrousels texte, peu regardés",
];

export const demoTopPosts = [
  { title: "Le studio se réveille", meta: "Reel · 12 s", stat: "4 800 vues", thumb: gradients.peach },
  { title: "Dernières places jeudi 7 h", meta: "Story", stat: "4 réservations", thumb: gradients.rose },
  { title: "Les 3 bienfaits du reformer", meta: "Carrousel", stat: "96 enregistrements", thumb: gradients.apricot },
];

export const demoAudience = [40, 52, 46, 92, 58, 35, 80];
