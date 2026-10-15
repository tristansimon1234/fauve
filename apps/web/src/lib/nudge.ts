import "server-only";
import { NUDGE_UPCOMING_DAYS, nudgeMessage, shouldNudge } from "@fauve/agent";
import { messageOwner } from "@/lib/owner-message";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The reminder when nothing has gone out for a while (packages/agent/src/nudge.ts),
// and what Simone sees of her presence at each turn.

const DAY = 86_400_000;
const PAST = ["published", "measured", "scheduled", "validated"];

async function lastPublication(studioId: string, now: number): Promise<number | null> {
  const { data } = await supabaseAdmin()
    .from("posts")
    .select("scheduled_at, published_at")
    .eq("studio_id", studioId)
    .in("status", PAST)
    .lte("scheduled_at", new Date(now).toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const at = (data?.published_at as string | null) ?? (data?.scheduled_at as string | null);
  return at ? Math.floor((now - new Date(at).getTime()) / DAY) : null;
}

/** Reminders sent since her last message (any channel). */
async function unansweredNudges(studioId: string): Promise<number> {
  const db = supabaseAdmin();
  const { data: last } = await db
    .from("whatsapp_messages")
    .select("created_at")
    .eq("studio_id", studioId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let query = db.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("direction", "outbound").eq("payload->>kind", "nudge");
  if (last) query = query.gt("created_at", last.created_at as string);
  const { count } = await query;
  return count ?? 0;
}

/** Sends the reminder if it is time; returns whether it was sent. */
export async function nudgeIfQuiet(studioId: string, now = Date.now()): Promise<boolean> {
  const db = supabaseAdmin();
  const [{ data: studio }, { data: rhythm }, { count: upcoming }, daysSince, { count: banked }] = await Promise.all([
    db.from("studios").select("nudged_at").eq("id", studioId).single(),
    db.from("content_plans").select("posts_per_week").eq("studio_id", studioId).maybeSingle(),
    db
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", studioId)
      .not("status", "in", "(skipped,failed)")
      .gt("scheduled_at", new Date(now).toISOString())
      .lte("scheduled_at", new Date(now + NUDGE_UPCOMING_DAYS * DAY).toISOString()),
    lastPublication(studioId, now),
    db.from("media_assets").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("bank", true),
  ]);
  const nudgedAt = studio?.nudged_at as string | null | undefined;
  const unanswered = await unansweredNudges(studioId);
  const ok = shouldNudge({
    unanswered,
    daysSince,
    upcoming: Boolean(upcoming),
    daysSinceNudge: nudgedAt ? Math.floor((now - new Date(nudgedAt).getTime()) / DAY) : null,
    postsPerWeek: rhythm?.posts_per_week as number | null | undefined,
  });
  if (!ok) return false;
  const text = nudgeMessage(daysSince, banked ?? 0);
  await messageOwner(studioId, {
    text,
    kind: "nudge",
    template: { name: "nudge", params: [daysSince === null ? "quelques" : String(daysSince)] },
  });
  await db.from("studios").update({ nudged_at: new Date(now).toISOString() }).eq("id", studioId);
  return true;
}

/** What Simone knows of her presence at each turn. */
export async function presenceLines(studioId: string, now = Date.now()): Promise<string[]> {
  const db = supabaseAdmin();
  const [daysSince, { data: studio }, { data: sorted }] = await Promise.all([
    lastPublication(studioId, now),
    db.from("studios").select("nudged_at").eq("id", studioId).single(),
    db
      .from("media_assets")
      .select("sorted_why, posts:sorted_post_id(title)")
      .eq("studio_id", studioId)
      .not("sorted_post_id", "is", null)
      .gte("created_at", new Date(now - DAY).toISOString())
      .limit(6),
  ]);
  const lines = [daysSince === null ? "Rien publié pour l'instant." : `Dernière publication il y a ${daysSince} jour${daysSince > 1 ? "s" : ""}.`];
  const nudgedAt = studio?.nudged_at as string | null | undefined;
  if (nudgedAt && now - new Date(nudgedAt).getTime() < 7 * DAY) lines.push("Un rappel lui a été envoyé cette semaine : ne la relance pas.");
  for (const m of sorted ?? []) {
    const title = (m.posts as unknown as { title: string | null } | null)?.title;
    lines.push(`Vidéo reçue et rangée toute seule dans « ${title ?? "une publication"} » : ${(m.sorted_why as string | null) ?? ""}`);
  }
  return lines;
}
