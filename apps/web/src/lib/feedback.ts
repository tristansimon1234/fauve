import "server-only";
import { feedbackDigest, ourStudio, PLAN_BUTTONS, upsetLevel, type FeedbackKind } from "@fauve/agent";
import { tellTeamOnce } from "@/lib/reply-cap";
import { supabaseAdmin } from "@/lib/supabase/admin";

// What people say of Edith and the app, kept for the team (table feedback; Tristan: « les feedbacks
// des users doivent être rangés quelque part »): by Edith (log_feedback), and without a turn from an
// upset message or « Changer le plan ». The team reads them in Admin and in a short morning message.

export type FeedbackRow = {
  studioId: string;
  kind: FeedbackKind;
  words: string;
  source: "whatsapp" | "web";
  byEdith: boolean;
  postId?: string | null;
  waMessageId?: string | null;
};

/** Kept; a failure never stops the conversation. */
export async function keepFeedback(row: FeedbackRow): Promise<void> {
  const words = row.words.trim().slice(0, 1000);
  if (!words) return;
  const { error } = await supabaseAdmin()
    .from("feedback")
    .insert({ studio_id: row.studioId, kind: row.kind, words, source: row.source, by_edith: row.byEdith, post_id: row.postId ?? null, wa_message_id: row.waMessageId ?? null });
  if (error) console.warn("feedback not kept", error.message);
}

/** Her message, kept when it says something of the product without Edith's turn: upset, or « Changer le plan » (with the plan it answers). */
export async function feedbackFromMessage(studioId: string, text: string, source: "whatsapp" | "web", waMessageId?: string): Promise<void> {
  const words = text.trim();
  if (!words) return;
  if (words === PLAN_BUTTONS[1]) {
    const { data: last } = await supabaseAdmin()
      .from("whatsapp_messages")
      .select("body")
      .eq("studio_id", studioId)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const plan = ((last?.body as string | null) ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    return keepFeedback({ studioId, kind: "plan", words: plan ? `Changer le plan : « ${plan} »` : words, source, byEdith: false, waMessageId });
  }
  if (upsetLevel(words)) await keepFeedback({ studioId, kind: "frustration", words, source, byEdith: false, waMessageId });
}

/**
 * Each morning (the nudge cron): yesterday's feedback in a few lines on the team's WhatsApp, once a day
 * (tellTeamOnce), the team's and the lab's own left out. Nothing when there was none.
 */
export async function sendFeedbackDigest(): Promise<void> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin()
    .from("feedback")
    .select("kind, words, created_at, studios(name, team, website_url)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).flatMap((r) => {
    const s = (Array.isArray(r.studios) ? r.studios[0] : r.studios) as { name?: string | null; team?: boolean | null; website_url?: string | null } | null;
    return s && ourStudio(s) ? [] : [{ kind: r.kind as FeedbackKind, words: r.words as string, studio: s?.name ?? "Sans nom" }];
  });
  const text = feedbackDigest(rows);
  if (text) await tellTeamOnce("feedback_digest", text);
}
