import "server-only";
import { addDays, localDateOf, localTimeOf, toIsoDate } from "@/lib/dates";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Free days to post on: the next days without a publication, at the studio's
// usual hour (the most common one of its last publications, else 18:00). Used
// by the new post sheet and by Fauve in the chat (suggest_dates).

export type Slot = { date: string; time: string; label: string; hint: string };

const DAYS_AHEAD = 14;

export async function freeSlots(studioId: string, timezone: string, count = 4, now = new Date()): Promise<Slot[]> {
  const db = supabaseAdmin();
  const [posts, past] = await Promise.all([
    db
      .from("posts")
      .select("scheduled_at")
      .eq("studio_id", studioId)
      .neq("status", "skipped")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", new Date(now.getTime() + (DAYS_AHEAD + 1) * 86_400_000).toISOString()),
    db.from("posts").select("scheduled_at").eq("studio_id", studioId).not("scheduled_at", "is", null).order("scheduled_at", { ascending: false }).limit(30),
  ]);

  const hours = new Map<string, number>();
  for (const p of past.data ?? []) {
    const { hours: h, minutes: m } = localTimeOf(new Date(p.scheduled_at as string), timezone);
    const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    hours.set(key, (hours.get(key) ?? 0) + 1);
  }
  const usual = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "18:00";

  const busy = new Set((posts.data ?? []).map((p) => toIsoDate(localDateOf(new Date(p.scheduled_at as string), timezone))));
  const today = localDateOf(now, timezone);
  const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const slots: Slot[] = [];
  for (let i = 1; i <= DAYS_AHEAD && slots.length < count; i++) {
    const iso = toIsoDate(addDays(today, i));
    if (busy.has(iso)) continue;
    slots.push({ date: iso, time: usual, label: label.format(new Date(`${iso}T12:00:00Z`)), hint: i === 1 ? "demain, jour libre" : "jour libre" });
  }
  return slots;
}
