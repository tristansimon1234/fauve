import "server-only";
import { isInSessionWindow, ownPick, pickedLine, type PickKind } from "@fauve/agent";
import { signMediaUrls, type StudioContext } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Her médiathèque on her phone (/choisir, packages/agent/src/media-pick.ts): what she can pick from, and her pick
// given back to her WhatsApp conversation as her message, which Edith answers there.

/** As many as a phone shows without scrolling forever: her latest week and her banque de plans fit. */
const PICKABLE = 60;

export type PickItem = { id: string; url: string; video: boolean; seconds: number | null; day: string };

/** « Aujourd’hui », « Hier », else « jeudi 6 novembre », in her business's time zone. */
export function dayLabel(at: Date, now: Date, timezone: string): string {
  const day = new Intl.DateTimeFormat("fr-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const key = (d: Date) => day.format(d);
  if (key(at) === key(now)) return "Aujourd’hui";
  if (key(at) === key(new Date(now.getTime() - 86_400_000))) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(at);
}

/** Her photos and videos, most recent first, signed for an hour (never public); only her studio's. */
export async function pickableMedia(db: StudioContext["db"], studioId: string, kind: PickKind, timezone: string): Promise<PickItem[]> {
  const kinds = kind === "photo" ? ["image"] : kind === "video" ? ["video"] : ["image", "video"];
  const { data, error } = await db
    .from("media_assets")
    .select("id, storage_path, kind, duration, created_at")
    .eq("studio_id", studioId)
    .in("kind", kinds)
    // Edith's own renders are not her files.
    .neq("source", "render")
    .order("created_at", { ascending: false })
    .limit(PICKABLE);
  if (error) throw new Error(`media_assets: ${error.message}`);
  const rows = data ?? [];
  const urls = await signMediaUrls(db, studioId, rows.map((r) => r.storage_path as string));
  const now = new Date();
  return rows.flatMap((r) => {
    const url = urls.get(r.storage_path as string);
    if (!url) return [];
    const seconds = r.duration == null ? null : Number(r.duration);
    return [{ id: r.id as string, url, video: r.kind === "video", seconds: seconds && Number.isFinite(seconds) ? seconds : null, day: dayLabel(new Date(r.created_at as string), now, timezone) }];
  });
}

export type PickDelivery = { ok: true; count: number; open: boolean } | { ok: false; error: string };

/**
 * Her pick, in her WhatsApp conversation as her message (the conversation is found by its trigger), marked as coming
 * from the page (`via`: it opens no 24 h window, she wrote nothing on WhatsApp). `open`: Edith can answer there now.
 */
export async function deliverPick(input: { studioId: string; phone: string; ids: string[] }): Promise<PickDelivery> {
  const db = supabaseAdmin();
  const { data: owned, error } = await db
    .from("media_assets")
    .select("id")
    .eq("studio_id", input.studioId)
    .in("id", input.ids)
    .in("kind", ["video", "image"])
    .neq("source", "render");
  if (error) return { ok: false, error: "Je n’arrive pas à lire ta médiathèque. Réessaie dans un instant." };
  const ids = ownPick(input.ids, (owned ?? []).map((r) => r.id as string));
  if (!ids.length) return { ok: false, error: "Ces fichiers ne sont plus dans ta médiathèque. Choisis-en d’autres." };
  // Before her pick is stored: can Edith write first?
  const { data: last } = await db
    .from("whatsapp_messages")
    .select("created_at")
    .eq("studio_id", input.studioId)
    .eq("channel", "whatsapp")
    .eq("direction", "inbound")
    .is("payload->>via", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const open = isInSessionWindow(last ? new Date(last.created_at as string) : null);
  const row = await db
    .from("whatsapp_messages")
    .insert({ studio_id: input.studioId, channel: "whatsapp", direction: "inbound", phone_e164: input.phone, type: "text", body: pickedLine(ids), payload: { via: "media_pick" } });
  if (row.error) return { ok: false, error: "Ton choix n’est pas passé. Réessaie." };
  return { ok: true, count: ids.length, open };
}
