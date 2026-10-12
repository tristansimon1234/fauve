// Calendar math in the studio's time zone (Europe/Paris by default), without a
// date library. A LocalDate is a wall-calendar day; instants stay plain Dates.

export type LocalDate = { year: number; month: number; day: number }; // month: 1–12

function partsIn(date: Date, timeZone: string) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, number> = {};
  for (const { type, value } of format.formatToParts(date)) parts[type] = Number(value);
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const p = partsIn(new Date(instant), timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(instant / 1000) * 1000;
}

export function localDateOf(date: Date, timeZone: string): LocalDate {
  const { year, month, day } = partsIn(date, timeZone);
  return { year, month, day };
}

/** The instant of local midnight on `date` in `timeZone`. */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day);
  // Two passes settle the offset around daylight-saving changes.
  let instant = wall - offsetAt(wall, timeZone);
  instant = wall - offsetAt(instant, timeZone);
  return new Date(instant);
}

/** The instant `days` × 24 h before `from`. */
export function daysBefore(from: Date, days: number): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: LocalDate): number {
  return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date));
}

export function sameDay(a: LocalDate, b: LocalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function toIsoDate(date: LocalDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

export function parseIsoDate(value: unknown): LocalDate | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  // Reject impossible days such as 2026-02-31.
  return sameDay(addDays(date, 0), date) ? date : null;
}

export type Week = {
  monday: LocalDate;
  days: LocalDate[];
  /** Local Monday 00:00, as an instant. */
  start: Date;
  /** Local next Monday 00:00, as an instant (exclusive). */
  end: Date;
};

export function weekOf(anyDay: LocalDate, timeZone: string): Week {
  const monday = mondayOf(anyDay);
  return {
    monday,
    days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    start: startOfLocalDay(monday, timeZone),
    end: startOfLocalDay(addDays(monday, 7), timeZone),
  };
}

const monthNames = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 1er », « 2 »… as written in French dates. */
export function dayNumber(date: LocalDate): string {
  return date.day === 1 ? "1er" : String(date.day);
}

/** « Semaine du 12 au 18 octobre », « Semaine du 28 septembre au 4 octobre ». */
export function weekLabel(week: Week): string {
  const first = week.monday;
  const last = week.days[6] ?? first;
  const lastPart = `${dayNumber(last)} ${monthNames[last.month - 1]}`;
  const firstPart =
    first.month === last.month ? dayNumber(first) : `${dayNumber(first)} ${monthNames[first.month - 1]}`;
  const yearPart = first.year !== last.year ? ` ${last.year}` : "";
  return `Semaine du ${firstPart} au ${lastPart}${yearPart}`;
}
