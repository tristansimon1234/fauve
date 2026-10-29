import "server-only";
import { DAILY_SIGNUPS, WAITLIST_AGAIN, WAITLIST_HOURS, WAITLIST_REPLY, WAITLIST_WELCOME, waitlistAlert } from "@fauve/agent";
import { localDateOf, localTimeOf, toIsoDate } from "@/lib/dates";
import { env } from "@/lib/env";
import { alertOnNewNumbers, teamToday, tellTeamOnce } from "@/lib/reply-cap";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";

// The first brake for a rush (packages/agent/src/brakes.ts): a new number gets its studio and the
// onboarding only while the day has room (DAILY_SIGNUPS); past it, she waits her turn on the
// waitlist, told once a day, and is let in as soon as there is room, in the day, by the publish
// cron (or by her own next message on a day with room). Nothing costly runs for her before.

const ZONE = "Europe/Paris";

export type Member = { id: string; studio_id: string; first_name: string | null };

const cap = () => env("DAILY_SIGNUPS") ?? DAILY_SIGNUPS;

/** New numbers still let in today. */
async function room(): Promise<number> {
  const { count, error } = await supabaseAdmin().from("members").select("id", { count: "exact", head: true }).gte("created_at", await teamToday());
  // Never shut the door on a failed count.
  if (error) return 1;
  return Math.max(0, cap() - (count ?? 0));
}

/** A fresh studio and its owner for a new number (null: a concurrent first message made it first). */
async function createMember(phone: string, firstName: string | null): Promise<Member | null> {
  const db = supabaseAdmin();
  const studio = await db.from("studios").insert({}).select("id").single();
  if (studio.error) throw new Error(studio.error.message);
  const created = await db
    .from("members")
    .insert({ studio_id: studio.data.id, phone_e164: phone, first_name: firstName, role: "owner" })
    .select("id, studio_id, first_name")
    .single();
  if (!created.data) {
    await db.from("studios").delete().eq("id", studio.data.id);
    return null;
  }
  await db.from("waitlist").update({ admitted_at: new Date().toISOString() }).eq("phone_e164", phone).is("admitted_at", null);
  // More numbers than usual starting today (a launch, or spam): the team is told once.
  await alertOnNewNumbers().catch((e) => console.warn("new numbers alert failed", e));
  return created.data;
}

/** Her member, or a new studio when the day has room; null: she waits (told by waitlist()). */
export async function memberOrRoom(phone: string, profileName?: string): Promise<Member | null> {
  const db = supabaseAdmin();
  const existing = await db.from("members").select("id, studio_id, first_name").eq("phone_e164", phone).maybeSingle();
  if (existing.data) return existing.data;
  if ((await room()) <= 0) return null;
  const made = await createMember(phone, profileName?.split(/\s+/)[0] ?? null);
  if (made) return made;
  // Lost a race with a concurrent first message: use the winner.
  const winner = await db.from("members").select("id, studio_id, first_name").eq("phone_e164", phone).single();
  if (winner.error) throw new Error(winner.error.message);
  return winner.data;
}

/** A new number on a full day: her place kept, and she is told once a day that she waits. */
export async function waitlist(phone: string, waId: string, profileName: string | undefined, text: string | null | undefined): Promise<void> {
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  await db
    .from("waitlist")
    .upsert(
      { phone_e164: phone, wa_id: waId, first_name: profileName?.split(/\s+/)[0] ?? null, first_text: text?.slice(0, 500) ?? null },
      { onConflict: "phone_e164", ignoreDuplicates: true },
    );
  const { data: row } = await db.from("waitlist").update({ last_message_at: now }).eq("phone_e164", phone).select("told_on").single();
  const day = toIsoDate(localDateOf(new Date(), ZONE));
  if (row?.told_on === day) return;
  // Told by one delivery only (Meta sends a message again when unsure).
  let claim = db.from("waitlist").update({ told_on: day }).eq("phone_e164", phone);
  claim = row?.told_on ? claim.eq("told_on", row.told_on as string) : claim.is("told_on", null);
  const { data: claimed } = await claim.select("phone_e164");
  if (!claimed?.length) return;
  await sendText(waId, row?.told_on ? WAITLIST_AGAIN : WAITLIST_REPLY).catch((e) => console.warn("waitlist reply failed", e));
  await tellTeamOnce("waitlist_alert", waitlistAlert(cap())).catch((e) => console.warn("waitlist alert failed", e));
}

/**
 * Lets the waitlist in while the day has room, in the day only (publish cron, every 5 minutes),
 * oldest first: her studio is made and Edith writes to her, which a WhatsApp reply allows within
 * 24 h of her last message. Later than that, she is let in by her own next message.
 */
export async function admitWaitlist(): Promise<string[]> {
  const { hours } = localTimeOf(new Date(), ZONE);
  if (hours < WAITLIST_HOURS.from || hours >= WAITLIST_HOURS.to) return [];
  const free = await room();
  if (!free) return [];
  const db = supabaseAdmin();
  const { data: waiting } = await db
    .from("waitlist")
    .select("phone_e164, wa_id, first_name")
    .is("admitted_at", null)
    .gt("last_message_at", new Date(Date.now() - 23 * 3600_000).toISOString())
    .order("created_at")
    .limit(Math.min(free, 20));
  const admitted: string[] = [];
  for (const w of waiting ?? []) {
    const phone = w.phone_e164 as string;
    // Claimed by one cron only.
    const { data: claimed } = await db.from("waitlist").update({ admitted_at: new Date().toISOString() }).eq("phone_e164", phone).is("admitted_at", null).select("phone_e164");
    if (!claimed?.length) continue;
    const member = await createMember(phone, (w.first_name as string | null) ?? null).catch((e: unknown) => {
      console.error("waitlist: studio not made", phone, e);
      return null;
    });
    if (!member) {
      await db.from("waitlist").update({ admitted_at: null }).eq("phone_e164", phone);
      continue;
    }
    const waMessageId = await sendText(w.wa_id as string, WAITLIST_WELCOME).catch((e: unknown) => {
      console.warn("waitlist welcome failed", phone, e);
      return undefined;
    });
    await db.from("whatsapp_messages").insert({ studio_id: member.studio_id, wa_message_id: waMessageId, direction: "outbound", phone_e164: phone, type: "text", body: WAITLIST_WELCOME, payload: { kind: "waitlist_welcome" } });
    admitted.push(phone);
  }
  return admitted;
}
