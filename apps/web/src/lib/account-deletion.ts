import "server-only";
import { ourStudio } from "@fauve/agent";
import { billingEnabled, cancelSubscription } from "@/lib/billing/stripe";
import { deleteStudio } from "@/lib/delete-studio";
import { tellTeamOnce } from "@/lib/reply-cap";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendReply, sendText } from "@/lib/whatsapp/client";

// Her account deleted, as the privacy policy promises (RGPD): when she asks (« Supprimer mes
// données » on WhatsApp, or « Supprimer mon compte » in Réglages), after a yes; and on its own 30
// days after her subscription ended, or 30 days after her last message when she never subscribed.
// Her subscription is stopped first (nothing charged after), then deleteStudio removes everything.
// Never the team's studio, a lab studio, or a studio without an owner (the landing's demo shops).

/** Her request, in the words of the deletion page (or close: « supprime mon compte »). */
const ASKS = /^\s*(je\s+veux\s+)?(supprimer?|supprimez|effacer?|effacez)\s+(toutes\s+)?(mes\s+donn[ée]es|mon\s+compte)\s*[.!]*\s*$/i;

export const DELETE_YES = "Oui, tout supprimer";
export const DELETE_NO = "Non, je garde tout";

const ASK_TEXT =
  "Tu veux supprimer toutes les données de ton commerce ? Ton compte, tes conversations, tes photos et vidéos, tes publications préparées, tes statistiques, tes connexions à Instagram et TikTok et ta voix clonée seront effacés pour de bon, et ton abonnement arrêté. Les publications déjà en ligne restent sur Instagram et TikTok.";
const DONE_TEXT = "C’est fait : toutes les données de ton commerce sont supprimées et ton abonnement est arrêté. Merci d’avoir essayé Edith 🙏";
const KEPT_TEXT = "C’est noté, je garde tout.";
const NOT_OWNER = "Seul le numéro du propriétaire du compte peut supprimer les données du commerce.";
const FAILED = "Je n’ai pas réussi à tout supprimer. L’équipe est prévenue et s’en occupe sous 30 jours.";

/** A month: after the subscription ends, or after the last message of a studio that never subscribed. */
const AFTER_MS = 30 * 86_400_000;

/** Deletes a studio for good: its subscription stopped first, the team told. False: one of ours, never deleted. */
export async function deleteAccount(studioId: string, why: "asked" | "ended" | "inactive"): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: studio } = await db.from("studios").select("name, team, website_url, stripe_subscription_id, subscription_status").eq("id", studioId).maybeSingle();
  if (!studio || ourStudio(studio)) return false;
  const live = studio.subscription_status && !["canceled", "incomplete_expired"].includes(studio.subscription_status as string);
  if (studio.stripe_subscription_id && live && billingEnabled()) await cancelSubscription(studio.stripe_subscription_id as string);
  await deleteStudio(studioId);
  const reason = why === "asked" ? "à sa demande" : why === "ended" ? "30 jours après la fin de son abonnement" : "30 jours sans message, jamais abonné";
  await tellTeamOnce(`account_deleted_${studioId}`, `Compte supprimé (${reason}) : ${(studio.name as string | null) ?? "sans nom"}.`).catch(() => {});
  return true;
}

/**
 * On WhatsApp, before Edith's turn: her request to delete everything gets a yes / no question, and
 * her yes (within a day) deletes it. True when the message was this, and nothing else should answer.
 */
export async function answerDeletion(studioId: string, memberId: string, phone: string, waId: string, text: string | null | undefined): Promise<boolean> {
  const said = text?.trim() ?? "";
  const db = supabaseAdmin();
  const reply = async (body: string, options?: string[], kind?: string) => {
    const id = await sendReply(waId, body, options).catch(() => undefined);
    await db.from("whatsapp_messages").insert({ studio_id: studioId, wa_message_id: id, direction: "outbound", phone_e164: phone, type: "text", body, payload: { ...(options ? { options } : {}), ...(kind ? { kind } : {}) } });
  };
  if (ASKS.test(said)) {
    const [{ data: member }, { data: studio }] = await Promise.all([
      db.from("members").select("role").eq("id", memberId).maybeSingle(),
      db.from("studios").select("team, website_url").eq("id", studioId).maybeSingle(),
    ]);
    if (member?.role !== "owner" || !studio || ourStudio(studio)) await reply(NOT_OWNER);
    else await reply(ASK_TEXT, [DELETE_YES, DELETE_NO], "delete_request");
    return true;
  }
  if (said !== DELETE_YES && said !== DELETE_NO) return false;
  // Only an answer to the question, asked in the last day.
  const { count } = await db
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", studioId)
    .eq("payload->>kind", "delete_request")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (!count) return false;
  if (said === DELETE_NO) {
    await reply(KEPT_TEXT);
    return true;
  }
  try {
    if (!(await deleteAccount(studioId, "asked"))) {
      await reply(NOT_OWNER);
      return true;
    }
    // Everything of hers is gone, this message too: sent, never kept.
    await sendText(waId, DONE_TEXT).catch(() => {});
  } catch (error) {
    console.error("account deletion failed", studioId, error);
    await tellTeamOnce(`account_deletion_failed_${studioId}`, `La suppression demandée d’un compte a échoué (studio ${studioId}) : à refaire avec /api/admin/delete-studio.`).catch(() => {});
    await sendText(waId, FAILED).catch(() => {});
  }
  return true;
}

/**
 * The retention cron: studios whose subscription ended over 30 days ago, and, billing on, studios
 * that never subscribed and have not written for 30 days. A few each run (deleting takes a while).
 */
export async function deleteExpiredAccounts(max = 3): Promise<string[]> {
  const db = supabaseAdmin();
  const before = new Date(Date.now() - AFTER_MS).toISOString();
  const deleted: string[] = [];
  const { data: ended } = await db
    .from("studios")
    .select("id, period_ends_at, subscription_synced_at")
    .in("subscription_status", ["canceled", "unpaid", "incomplete_expired"])
    .eq("team", false)
    .limit(50);
  const due = (ended ?? []).filter((s) => {
    const end = (s.period_ends_at as string | null) ?? (s.subscription_synced_at as string | null);
    return end !== null && end < before;
  });
  for (const s of due.slice(0, max)) {
    if (await deleteAccount(s.id as string, "ended").catch((e: unknown) => (console.error("expired account not deleted", s.id, e), false))) deleted.push(s.id as string);
  }
  // Never subscribed: only once one can (billing on), and only a studio someone owns.
  if (!billingEnabled() || deleted.length >= max) return deleted;
  const { data: idle } = await db
    .from("studios")
    .select("id, members!inner(role)")
    .is("stripe_subscription_id", null)
    .is("subscription_status", null)
    .eq("team", false)
    .eq("members.role", "owner")
    .lt("created_at", before)
    .limit(50);
  for (const s of idle ?? []) {
    if (deleted.length >= max) break;
    const { count } = await db.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("studio_id", s.id as string).eq("direction", "inbound").gte("created_at", before);
    if (count) continue;
    if (await deleteAccount(s.id as string, "inactive").catch((e: unknown) => (console.error("idle account not deleted", s.id, e), false))) deleted.push(s.id as string);
  }
  return deleted;
}
