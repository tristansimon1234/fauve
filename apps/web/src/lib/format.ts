import type { Platform, PostKind } from "@fauve/agent";

// French labels and date formatting for the web app.

export const kindLabels: Record<PostKind, string> = {
  reel: "Reel",
  post: "Post",
  carousel: "Carrousel",
  story: "Story",
};

export const platformLabels: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, ...options });
}

/** « jeudi 15 octobre à 18:00 » */
export function formatDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = formatter(timeZone, { weekday: "long", day: "numeric", month: "long" }).format(date);
  return `${day} à ${formatTime(iso, timeZone)}`;
}

/** « jeu. 15 oct. · 18:00 » */
export function formatShortDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = formatter(timeZone, { weekday: "short", day: "numeric", month: "short" }).format(date);
  return `${day} · ${formatTime(iso, timeZone)}`;
}

/** « 15 oct. » */
export function formatShortDate(iso: string, timeZone: string): string {
  return formatter(timeZone, { day: "numeric", month: "short" }).format(new Date(iso));
}

/** « 18:00 » */
export function formatTime(iso: string, timeZone: string): string {
  return formatter(timeZone, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** « 0:08 » from seconds. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** « 2,5 s » */
export function formatSeconds(seconds: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(seconds)} s`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

/** « +33 6 12 34 56 78 » for French numbers, unchanged otherwise. */
export function formatPhone(e164: string): string {
  const fr = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return fr ? `+33 ${fr.slice(1).join(" ")}` : e164;
}

/** « studiolune.fr » from a full URL. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** « 1 publication », « 3 publications ». */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const [first = "", second = ""] = words;
  const letters = second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2);
  return letters.toUpperCase() || "F";
}
