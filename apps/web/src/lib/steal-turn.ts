import "server-only";
import { answerInApp } from "@/lib/chat";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { replyOnWhatsApp } from "@/lib/whatsapp/inbound";

// The plan of a Reel that copies another is written once that Reel is read. Before, Edith wrote her
// plan in the turn that started the reading, a minute before it landed (Tristan's « The power of
// Paris »: two plans, then « J'ai regardé ton modèle »): the plan she validated knew nothing of the
// model. Now that turn only says Edith is looking at it, and the reading hands Edith a turn of her own.

/** What Edith is told when the Reel she was sent is read (her context line « Reel à recopier » has its reading). */
export const READ_NOTE =
  "[Le Reel qu'elle t'a envoyé à recopier est lu : ta ligne « Reel à recopier » dit ce que son Reel en reprend. " +
  "Si elle t'a dit ce qu'elle veut pour ce Reel et donné ses fichiers (ou dit lesquels prendre), écris maintenant ton plan (reply_with plan), " +
  "construit sur ce modèle et sur sa demande (ses mots passent avant le modèle), et dis en une phrase ce que tu reprends du modèle ; " +
  "sinon, dis-lui en deux phrases ce que son Reel en reprend et demande-lui ses photos et vidéos. Ne redis pas que tu le regardes.]";

/**
 * Edith's turn once the Reel she was sent is read, where she was sent it: on WhatsApp (her number),
 * else in the app conversation. False when there is no one to answer (a lab studio) or nothing was said.
 */
export async function planAfterReading(job: { studioId: string; waId?: string; conversationId?: string }): Promise<boolean> {
  const db = supabaseAdmin();
  if (job.waId) {
    const { data: member } = await db.from("members").select("id, phone_e164").eq("studio_id", job.studioId).eq("phone_e164", `+${job.waId}`).maybeSingle();
    if (!member) return false;
    await replyOnWhatsApp({ studioId: job.studioId, memberId: member.id as string, waId: job.waId, phone: member.phone_e164 as string, note: READ_NOTE });
    return true;
  }
  if (!job.conversationId) return false;
  const { data: members } = await db.from("members").select("id, role").eq("studio_id", job.studioId).order("role", { ascending: true }).limit(5);
  const member = (members ?? []).find((m) => m.role === "owner") ?? members?.[0];
  if (!member) return false;
  return answerInApp({ studioId: job.studioId, memberId: member.id as string, conversationId: job.conversationId, note: READ_NOTE });
}
