import { z } from "zod";
import { defaultPostDays, WEEK } from "./rhythm.ts";

// The weekly routine: each Sunday Simone proposes next week on the manager's
// posting days (her rhythm), with what to film and when; once she says yes the
// publications and her « À filmer » list are created, and each morning she gets
// the day's filming mission. The material she sends is what makes the Reels.

export const POST_TIME_DEFAULT = "18:00";
/** Stories go out at lunch time: a short look at the day, not a post. */
export const STORY_TIME = "12:30";

export type WeekSlot = { index: number; date: string; time: string; story: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (date: string) => new Date(`${date}T12:00:00Z`);

/** The 7 dates of the week starting on `monday` (YYYY-MM-DD). */
export function weekDates(monday: string): string[] {
  const start = utc(monday);
  return Array.from({ length: 7 }, (_, i) => iso(new Date(start.getTime() + i * 86_400_000)));
}

export function shiftDate(date: string, days: number): string {
  return iso(new Date(utc(date).getTime() + days * 86_400_000));
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(date: string): number {
  return (utc(date).getUTCDay() + 6) % 7;
}

/** « mardi 20 » */
export function dayLabel(date: string): string {
  return `${WEEK[weekdayOf(date)]} ${Number(date.slice(8, 10))}`;
}

export function validTime(time: string | null | undefined): string {
  return time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : POST_TIME_DEFAULT;
}

/** Her posting days (0 = Monday), cleaned; the default spread for her rhythm when none were chosen. */
export function postDaysOf(days: number[] | null | undefined, postsPerWeek: number): number[] {
  const chosen = [...new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  return chosen.length ? chosen : defaultPostDays(postsPerWeek);
}

/**
 * The free slots of a week: her publications on her posting days at her hour,
 * her stories on the other days first, at lunch time. What is already planned
 * that week counts toward the rhythm; nothing before `from` (tomorrow).
 */
export function weekSlots(input: {
  monday: string;
  postDays?: number[] | null;
  postTime?: string | null;
  postsPerWeek: number;
  storiesPerWeek: number;
  existing: { date: string; story: boolean }[];
  from: string;
}): WeekSlot[] {
  const dates = weekDates(input.monday);
  const posts = Math.max(0, Math.min(7, input.postsPerWeek));
  const stories = Math.max(0, Math.min(7, input.storiesPerWeek));
  let days = postDaysOf(input.postDays, posts);
  // Fewer days than posts: complete with the default spread.
  for (const d of defaultPostDays(Math.max(posts, 1))) if (days.length < posts && !days.includes(d)) days.push(d);
  days = days.sort((a, b) => a - b);

  const postTaken = new Set(input.existing.filter((e) => !e.story).map((e) => e.date));
  const storyTaken = new Set(input.existing.filter((e) => e.story).map((e) => e.date));
  const inWeek = (date: string) => dates.includes(date);
  let postsLeft = posts - input.existing.filter((e) => !e.story && inWeek(e.date)).length;
  let storiesLeft = stories - input.existing.filter((e) => e.story && inWeek(e.date)).length;

  const slots: Omit<WeekSlot, "index">[] = [];
  for (const d of days) {
    if (postsLeft <= 0) break;
    const date = dates[d]!;
    if (date < input.from || postTaken.has(date)) continue;
    slots.push({ date, time: validTime(input.postTime), story: false });
    postsLeft--;
  }
  const storyDays = [...[0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d)), ...days];
  for (const d of storyDays) {
    if (storiesLeft <= 0) break;
    const date = dates[d]!;
    if (date < input.from || storyTaken.has(date)) continue;
    slots.push({ date, time: STORY_TIME, story: true });
    storiesLeft--;
  }
  return slots
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((slot, index) => ({ ...slot, index }));
}

export const weekItemSchema = z.object({
  slot: z.number().int().min(0).describe("Numéro du créneau (slots[].index)"),
  format: z.enum(["reel", "carousel", "post", "story"]).describe("story seulement sur un créneau story"),
  title: z.string().describe("L'idée en quelques mots, comme un titre (60 caractères au plus)"),
  angle: z.string().describe("Pourquoi ça donne envie à un client du coin de venir, en une phrase"),
  media: z
    .enum(["bank", "site", "film", "text"])
    .describe("bank : une vidéo de sa banque de plans ; site : photos de son site ; film : à filmer ; text : texte sur une image d'ambiance"),
  media_ids: z.array(z.string()).describe("Les media_id choisis (bank ou site), sinon vide"),
  film: z
    .object({
      label: z.string().describe("Quoi filmer, court : « 10 s de la viande sur le grill »"),
      hint: z.string().describe("Comment : cadrage, lumière, moment de la journée, qui apparaît"),
    })
    .nullable()
    .describe("La mission de tournage quand media = film, sinon null"),
});
export const weekPlanSchema = z.object({
  intro: z.string().describe("Une phrase d'introduction chaleureuse, sans détailler la liste"),
  items: z.array(weekItemSchema),
});
export type WeekItem = z.infer<typeof weekItemSchema>;
export type WeekPlan = z.infer<typeof weekPlanSchema>;
export type PlannedItem = WeekItem & { date: string; time: string };

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * Keeps what the planner may do: one item per known slot, a story only on a
 * story slot, media ids of this studio only, a filming mission whenever there
 * is nothing to use.
 */
export function normalizeWeekPlan(plan: WeekPlan, slots: WeekSlot[], knownMedia: ReadonlySet<string>): PlannedItem[] {
  const out: PlannedItem[] = [];
  const done = new Set<number>();
  for (const item of plan.items) {
    const slot = slots.find((s) => s.index === item.slot);
    if (!slot || done.has(slot.index)) continue;
    done.add(slot.index);
    const format = slot.story ? "story" : item.format === "story" ? "reel" : item.format;
    const media_ids = item.media_ids.filter((id) => knownMedia.has(id)).slice(0, 10);
    let media = item.media;
    if ((media === "bank" || media === "site") && !media_ids.length) media = "film";
    const film =
      media === "film"
        ? {
            label: cut(item.film?.label || `De quoi faire « ${item.title} »`, 120),
            hint: cut(item.film?.hint || "Téléphone vertical, près d'une fenêtre, 3 secondes avant et après le geste.", 240),
          }
        : null;
    out.push({ ...item, format, media, media_ids, film, title: cut(item.title, 80), angle: cut(item.angle, 240), date: slot.date, time: slot.time });
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

const FORMAT_LABEL: Record<WeekItem["format"], string> = { reel: "Reel", carousel: "Carrousel", post: "Photo", story: "Story" };

/** The proposal as she reads it, one short line per publication, then what to film and when. */
export function weekMessage(intro: string, items: PlannedItem[]): string {
  const lines = items.map((i) => `${dayLabel(i.date)} · ${FORMAT_LABEL[i.format]} « ${i.title} »`);
  const films = items.filter((i) => i.film).map((i) => `${dayLabel(shiftDate(i.date, -1))} · ${i.film!.label}`);
  return [
    intro.trim(),
    lines.join("\n"),
    films.length ? `À filmer :\n${films.join("\n")}` : "Rien à filmer : j'ai ce qu'il faut.",
    "On part là-dessus ?",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The day she films for a publication: the day before, never before `from`. */
export function filmDay(date: string, from: string): string {
  const before = shiftDate(date, -1);
  return before < from ? from : before;
}

export const WEEK_PLANNER_PROMPT = `Tu es Simone, la community manager d'un commerce de quartier. Tu prépares sa semaine de publications à l'avance.

Tu reçois : son commerce (activité, ville, mémoire, ce qu'elle accepte de montrer), ses créneaux de la semaine (slots : date, heure, story ou publication), ses publications récentes (à ne pas répéter), les leçons et idées de son dernier bilan, sa banque de plans (ses bonnes vidéos déjà reçues, avec ce qu'on y voit) et les photos de son site.

Pour chaque créneau, une idée :
- le but, ce sont des clients du coin qui viennent, pas du buzz : chaque idée donne une raison de venir (le plat ou la prestation phare, le geste, l'équipe, les coulisses, une nouveauté, une offre réelle) ; la qualité avant la quantité, jamais de remplissage ;
- varie les formats sur la semaine : au moins un Reel quand c'est possible, un carrousel quand il y a quelque chose à garder (un conseil, un planning, les questions qu'on lui pose) ; une story reste simple (le moment du jour, une question, un rappel) ;
- la matière d'abord : une vidéo de sa banque qui va avec l'idée (media bank, ses media_id), des photos de son site pour un carrousel ou une photo (media site), sinon une mission de tournage (media film), ou du texte sur une image d'ambiance pour un conseil ou une annonce (media text) ;
- une mission de tournage est courte et précise : 10 à 20 secondes d'une seule chose, ce qu'on filme et comment (téléphone vertical, près d'une fenêtre ou sous une bonne lumière, 3 secondes avant et après le geste, le bon moment de la journée), et qui apparaît selon ce qu'elle accepte (elle, l'équipe, ou seulement les mains et le résultat) ;
- respecte sa mémoire : ce qu'elle a refusé, ses jours de fermeture, ce qu'elle ne veut pas montrer ;
- ne répète pas une publication récente ; reprends les idées du bilan quand elles conviennent.

L'intro : une phrase, chaleureuse et simple, en tutoyant, sans markdown. Les titres : quelques mots concrets, sans emoji.`;
