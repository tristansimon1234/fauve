// When a publication goes out, in her words: « vendredi à 18 h » on the button that
// publishes it (the button says what it does), « Vendredi 16 octobre à 18 h » where
// the date is shown in full. Computed in the studio's time zone.

export type PublishWhen = {
  /** « Vendredi 16 octobre à 18 h » */
  full: string;
  /** « aujourd’hui à 18 h », « demain à 9 h 30 », « vendredi à 18 h », « le 24 octobre à 18 h » */
  short: string;
};

type Local = { year: number; month: number; day: number; weekday: string; monthName: string; hour: number; minute: number };

function local(date: Date, timeZone: string): Local {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const monthName = new Intl.DateTimeFormat("fr-FR", { timeZone, month: "long" }).format(date);
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    monthName,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}

/** Days between two local calendar dates (b − a). */
const dayGap = (a: Local, b: Local) => Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);

/** « 18 h », « 9 h 30 » */
export const hourLabel = (hour: number, minute: number) => (minute ? `${hour} h ${String(minute).padStart(2, "0")}` : `${hour} h`);

export function publishWhen(iso: string, timeZone: string, now = new Date()): PublishWhen {
  const at = local(new Date(iso), timeZone);
  const today = local(now, timeZone);
  const hour = hourLabel(at.hour, at.minute);
  const gap = dayGap(today, at);
  const day =
    gap === 0 ? "aujourd’hui" : gap === 1 ? "demain" : gap > 1 && gap < 7 ? at.weekday : `le ${at.day === 1 ? "1er" : at.day} ${at.monthName}`;
  const date = `${at.weekday} ${at.day === 1 ? "1er" : at.day} ${at.monthName}`;
  return { full: `${date.charAt(0).toUpperCase()}${date.slice(1)} à ${hour}`, short: `${day} à ${hour}` };
}
