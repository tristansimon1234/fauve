// The rhythm step: what a week of publications looks like, to help the manager
// choose without pushing for more. Quality over quantity: a few posts made with
// care, every week, rather than many made fast.

const WEEK = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Posting days spread over the week for each count. */
const DAYS: Record<number, string[]> = {
  1: ["jeudi"],
  2: ["mardi", "vendredi"],
  3: ["mardi", "jeudi", "samedi"],
  4: ["lundi", "mercredi", "vendredi", "samedi"],
  5: ["lundi", "mardi", "jeudi", "vendredi", "samedi"],
  6: WEEK.slice(0, 6),
  7: WEEK,
};

/** What to post, in this order: a result first, something to keep, a face, then the rest. Fits any business. */
const IDEAS = [
  "un Reel : le résultat, puis le geste qui y mène",
  "un carrousel : un conseil à garder",
  "un Reel : toi ou ton équipe, en une phrase utile",
  "une photo : la nouveauté ou l'offre du moment",
  "un Reel : les coulisses",
  "un carrousel : les questions qu'on te pose",
  "un Reel : un client qui raconte, avec son accord",
];

/** A sample week for a number of posts: one day and one idea per post. */
export function sampleWeek(posts: number): { day: string; idea: string }[] {
  const n = Math.max(1, Math.min(7, Math.round(posts)));
  return DAYS[n]!.map((day, i) => ({ day, idea: IDEAS[i % IDEAS.length]! }));
}

/** The presets of the rhythm card, the advised one marked. */
export const RHYTHM_PRESETS = [
  { label: "Tranquille", posts: 2, stories: 3, advised: false },
  { label: "Régulier", posts: 3, stories: 4, advised: true },
  { label: "Très présent", posts: 4, stories: 7, advised: false },
] as const;
