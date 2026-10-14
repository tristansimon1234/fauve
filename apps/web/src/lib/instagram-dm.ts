import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { replyInConversation } from "@/lib/agent/conversation";
import { InstagramError, sendDirectMessage } from "@/lib/social/instagram";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readInspiration } from "@/lib/video/inspiration";

// DMs to Fauve's own Instagram account. A manager links her Instagram to her
// studio once (a code shown in the app), then:
//  - shares Reels and posts she likes ("Partager → Fauve"): they become
//    inspirations, read by Gemini, that guide the montages;
//  - writes to Fauve: same assistant and same history as WhatsApp.

const CODE_TTL_MS = 60 * 60_000;

export const dmEventSchema = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number().optional(),
  message: z
    .object({
      mid: z.string(),
      text: z.string().optional(),
      is_echo: z.boolean().optional(),
      is_deleted: z.boolean().optional(),
      attachments: z
        .array(z.object({ type: z.string(), payload: z.object({ url: z.string().optional(), title: z.string().optional(), reel_video_id: z.string().optional() }).loose().optional() }))
        .optional(),
    })
    .optional(),
});
export type DmEvent = z.infer<typeof dmEventSchema>;

/** Fauve's own account (connected by an admin), or null if not connected yet. */
export async function fauveAccount() {
  const { data } = await supabaseAdmin().from("platform_accounts").select("ig_user_id, username, access_token").eq("key", "fauve_instagram").maybeSingle();
  return data ? { userId: data.ig_user_id as string, username: (data.username as string | null) ?? null, token: data.access_token as string } : null;
}

/** A one-time code (6 digits, 1 hour) the manager sends to Fauve on Instagram to link her account. */
export async function createLinkCode(studioId: string): Promise<string> {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 1000000));
    const { error } = await db.from("instagram_link_codes").insert({ code, studio_id: studioId, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() });
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("instagram_link_codes: no free code");
}

async function linkWithCode(igsid: string, code: string): Promise<{ name: string } | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("instagram_link_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("studio_id")
    .maybeSingle();
  if (!data) return null;
  await db.from("instagram_contacts").upsert({ igsid, studio_id: data.studio_id, linked_at: new Date().toISOString() });
  const { data: studio } = await db.from("studios").select("name").eq("id", data.studio_id).single();
  return { name: (studio?.name as string | null) ?? "ton studio" };
}

const SHARE_TYPES = new Set(["ig_reel", "reel", "share", "ig_post", "image", "video", "story_mention"]);

/** Handles one message sent to Fauve's Instagram account. */
export async function handleDm(event: DmEvent): Promise<void> {
  const message = event.message;
  if (!message || message.is_echo || message.is_deleted) return;
  const account = await fauveAccount();
  if (!account || event.sender.id === account.userId) return;
  const igsid = event.sender.id;
  const reply = (text: string) =>
    sendDirectMessage(account.token, igsid, text).catch((e: unknown) => console.error("DM reply failed", e instanceof InstagramError ? e.body : e));

  const db = supabaseAdmin();
  const { data: contact } = await db.from("instagram_contacts").select("studio_id").eq("igsid", igsid).maybeSingle();
  if (!contact) {
    const code = message.text?.match(/\b\d{6}\b/)?.[0];
    const linked = code ? await linkWithCode(igsid, code) : null;
    await reply(
      linked
        ? `C’est relié à ${linked.name} ! Partage-moi les Reels qui t’inspirent (bouton Partager → Brigitte) : je les garde pour ton style. Tu peux aussi m’écrire ici.`
        : code
          ? "Ce code n’est plus valable. Récupère-en un nouveau dans l’app (Réglages → Instagram) et renvoie-le-moi."
          : "Hello, je suis Brigitte, l’IA qui gère les réseaux de ton studio. Pour relier ton compte, envoie-moi le code affiché dans l’app (Réglages → Instagram).",
    );
    return;
  }
  const studioId = contact.studio_id as string;

  // Shared Reels and posts: inspirations, read once by Gemini.
  const shares = (message.attachments ?? []).filter((a) => SHARE_TYPES.has(a.type) && a.payload?.url);
  if (shares.length) {
    const { data: seen } = await db.from("inspirations").select("id").eq("studio_id", studioId).eq("external_id", message.mid).limit(1);
    if (seen?.length) return; // retried delivery
    let reading: string | null = null;
    for (const share of shares.slice(0, 3)) {
      const analysis = await readInspiration(studioId, share.payload!.url!).catch((e: unknown) => (console.warn("inspiration reading failed", e), null));
      reading ??= analysis;
      await db.from("inspirations").insert({
        studio_id: studioId,
        kind: share.type,
        url: share.payload!.url,
        title: share.payload!.title ?? null,
        external_id: message.mid,
        analysis,
      });
    }
    const firstLine = reading?.split(/(?<=\.)\s/)[0];
    await reply(firstLine ? `Noté pour ton style ✨ ${firstLine}` : "Noté pour ton style ✨ Je m’en inspire pour tes prochains montages.");
    return;
  }

  // Text: the same Fauve and the same history as WhatsApp and the app.
  if (!message.text?.trim()) return;
  const inserted = await db
    .from("whatsapp_messages")
    .upsert(
      { studio_id: studioId, wa_message_id: `ig:${message.mid}`, channel: "instagram", direction: "inbound", type: "text", body: message.text.slice(0, 4000) },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (!inserted.data?.length) return; // retried delivery
  const { data: owner } = await db.from("members").select("id").eq("studio_id", studioId).eq("role", "owner").limit(1).maybeSingle();
  if (!owner) return;
  const result = await replyInConversation({ studioId, memberId: owner.id as string, reactToRowId: inserted.data[0]!.id as string, channel: "instagram" });
  if (result.reply) {
    await reply(result.reply);
    await db.from("whatsapp_messages").insert({ studio_id: studioId, channel: "instagram", direction: "outbound", type: "text", body: result.reply, payload: { ...result.extras, notes: result.notes } });
  }
  for (const job of result.afterReply) await job().catch((e) => console.error("DM after-reply job failed", e));
}
