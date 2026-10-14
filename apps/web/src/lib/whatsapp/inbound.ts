import "server-only";
import { awaitsAnswer, echoFor, emojiOnly, onboardingStepOf, replyExtrasSchema } from "@fauve/agent";
import { claimPairing } from "@/lib/auth/pairing";
import { deliverPendingHandOffs } from "@/lib/social/hand-off";
import { replyInConversation } from "@/lib/agent/conversation";
import { quoteButtons } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { setReaction } from "@/lib/reactions";
import { env } from "@/lib/env";
import { downloadMedia, markReadAndTyping, sendReaction, sendReply, sendText } from "./client";
import { mediaOf, textOf, toE164, type InboundMessage } from "./schema";

// Several messages often arrive together (a caption + 5 clips). We wait briefly and
// let only the latest message of the burst run the agent, which sees them all.
const BURST_DEBOUNCE_MS = 4000;

const TECHNICAL_ISSUE_REPLY =
  "Petit souci technique de mon côté, je n’ai pas pu traiter ton message. Réessaie dans quelques minutes, désolée !";

type Member = { id: string; studio_id: string; first_name: string | null };

async function findOrCreateMember(phone: string, profileName?: string): Promise<Member> {
  const db = supabaseAdmin();
  const existing = await db.from("members").select("id, studio_id, first_name").eq("phone_e164", phone).maybeSingle();
  if (existing.data) return existing.data;

  // Unknown number: start onboarding with a fresh studio.
  const studio = await db.from("studios").insert({}).select("id").single();
  if (studio.error) throw new Error(studio.error.message);
  const firstName = profileName?.split(/\s+/)[0] ?? null;
  const created = await db
    .from("members")
    .insert({ studio_id: studio.data.id, phone_e164: phone, first_name: firstName, role: "owner" })
    .select("id, studio_id, first_name")
    .single();
  if (created.data) return created.data;

  // Lost a race with a concurrent first message: use the winner and drop our studio.
  await db.from("studios").delete().eq("id", studio.data.id);
  const winner = await db.from("members").select("id, studio_id, first_name").eq("phone_e164", phone).single();
  if (winner.error) throw new Error(winner.error.message);
  return winner.data;
}

const extensionByMime: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

async function storeMedia(studioId: string, message: InboundMessage): Promise<{ id: string; isVideo: boolean } | null> {
  const ref = mediaOf(message);
  if (!ref) return null;
  const db = supabaseAdmin();
  const file = await downloadMedia(ref.id);
  const ext = extensionByMime[file.mimeType] ?? "bin";
  const path = `${studioId}/whatsapp/${message.id}.${ext}`;
  const upload = await db.storage.from("media").upload(path, file.bytes, { contentType: file.mimeType, upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const asset = await db
    .from("media_assets")
    .insert({
      studio_id: studioId,
      storage_path: path,
      kind: ref.kind,
      source: "whatsapp",
      mime_type: file.mimeType,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (asset.error) throw new Error(asset.error.message);
  return { id: asset.data.id as string, isVideo: ref.kind === "video" || file.mimeType.startsWith("video/") };
}

export async function handleInboundMessage(message: InboundMessage, profileName?: string): Promise<void> {
  const db = supabaseAdmin();
  const phone = toE164(message.from);
  const member = await findOrCreateMember(phone, profileName);

  // Idempotency: Meta retries deliveries, wa_message_id is unique.
  const inserted = await db
    .from("whatsapp_messages")
    .upsert(
      {
        studio_id: member.studio_id,
        wa_message_id: message.id,
        direction: "inbound",
        phone_e164: phone,
        type: message.type,
        body: textOf(message),
        payload: message,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (inserted.error) throw new Error(inserted.error.message);
  if (!inserted.data.length) return; // duplicate delivery

  // A reaction from the manager needs no answer: it is shown on the message in the web chat.
  if (message.type === "reaction") {
    if (message.reaction?.message_id) await setReaction({ waMessageId: message.reaction.message_id }, "me", message.reaction.emoji || null);
    return;
  }

  await markReadAndTyping(message.id).catch((e) => console.warn("typing indicator failed", e));

  // « Bonjour Fauve ! Code : K7P2QX » from the start screen on a computer: that screen opens
  // her space, and the getting started goes on there.
  if (message.type === "text" && (await claimPairing(textOf(message), phone))) {
    const { data: studio } = await db.from("studios").select("onboarding_step").eq("id", member.studio_id).single();
    const fresh = onboardingStepOf(studio?.onboarding_step) !== "done";
    const reply = fresh
      ? `Bonjour${member.first_name ? ` ${member.first_name}` : ""} ! Moi c’est Simone, ta community manager (une IA) ✨ Ton ordinateur est connecté : on fait connaissance sur l’écran, je t’y attends. Tu pourras m’écrire ici aussi, à tout moment.`
      : "C’est bon, ton ordinateur est connecté ✨";
    const waMessageId = await sendText(message.from, reply).catch(() => undefined);
    await db.from("whatsapp_messages").insert({ studio_id: member.studio_id, wa_message_id: waMessageId, direction: "outbound", phone_e164: phone, type: "text", body: reply, payload: { reply_to: message.id } });
    return;
  }

  // Her answer to the « ready_to_post » template: the Reels to publish herself, now.
  await deliverPendingHandOffs(member.studio_id, phone).catch((e) => console.error("pending hand-offs failed", e));

  const media = await storeMedia(member.studio_id, message).catch((e) => {
    console.error("media storage failed", e);
    return null;
  });
  if (media) await db.from("whatsapp_messages").update({ media_id: media.id }).eq("wa_message_id", message.id);

  // Watching a clip takes up to a minute: acknowledge it now (👍 = reçu), then start
  // the analysis right away so whoever answers finds it ready.
  if (media?.isVideo) {
    await sendReaction(message.from, message.id, "👍")
      .then(() => setReaction({ waMessageId: message.id }, "fauve", "👍"))
      .catch((e) => console.warn("reaction failed", e));
  }
  const analysis = media?.isVideo
    ? ensureClipAnalysis(member.studio_id, media.id).catch((e) => console.error("clip analysis failed", e))
    : null;

  await new Promise((resolve) => setTimeout(resolve, BURST_DEBOUNCE_MS));
  const latest = await db
    .from("whatsapp_messages")
    .select("wa_message_id")
    .eq("studio_id", member.studio_id)
    .eq("direction", "inbound")
    // A reaction (stored as a row) never stands for the latest message to answer.
    .neq("type", "reaction")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  // A newer message will answer; finish the analysis so it is there for that reply.
  if (latest.data?.wa_message_id !== message.id) {
    await analysis;
    return;
  }
  await analysis;

  // Only emojis (« 🔥 », « ❤️ ») that answer nothing: a reaction back at once, no turn needed.
  const text = textOf(message);
  if (message.type === "text" && emojiOnly(text)) {
    const echo = echoFor(text ?? "");
    const { data: last } = await db
      .from("whatsapp_messages")
      .select("body, payload")
      .eq("studio_id", member.studio_id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const extras = replyExtrasSchema.catch({}).parse(last?.payload ?? {});
    if (echo && !awaitsAnswer(last ? { body: last.body as string | null, options: extras.options, quote: Boolean(extras.quote) } : null)) {
      await sendReaction(message.from, message.id, echo)
        .then(() => setReaction({ waMessageId: message.id }, "fauve", echo))
        .catch((e) => console.warn("reaction failed", e));
      return;
    }
  }

  let result: Awaited<ReturnType<typeof replyInConversation>>;
  try {
    result = await replyInConversation({
      studioId: member.studio_id,
      memberId: member.id,
      waId: message.from,
      replyToMessageId: message.id,
    });
  } catch (error) {
    // Never leave the manager on a "typing…" that leads nowhere. Not stored, so
    // the conversation history stays clean for the next attempt.
    console.error("agent failed, sending fallback reply", error);
    await sendText(message.from, TECHNICAL_ISSUE_REPLY).catch((e) => console.error("fallback reply failed", e));
    return;
  }

  if (result.reply) {
    const { posts, grid, quote } = result.extras;
    // A quote gets its yes / other level / no buttons, unless Fauve chose others.
    // The quote's own buttons win over the model's (they carry the other level).
    // (none for a montage already launched).
    const buttons = quote ? await quoteButtons(member.studio_id, quote).catch(() => []) : [];
    const options = buttons.length ? buttons : result.extras.options;
    // Cards are app-only: on WhatsApp they become links to the app.
    const links = [
      ...(posts ?? []).map((id) => `${env("APP_URL")}/publications/${id}`),
      ...(grid ? [`Ta grille : ${env("APP_URL")}/grille`] : []),
    ];
    const waMessageId = await sendReply(message.from, result.reply, options, links);
    await db.from("whatsapp_messages").insert({
      studio_id: member.studio_id,
      wa_message_id: waMessageId,
      direction: "outbound",
      phone_e164: phone,
      type: "text",
      body: result.reply,
      payload: { reply_to: message.id, ...result.extras, notes: result.notes },
    });
  }
  // E.g. a render: the video follows the "je monte ta vidéo" reply.
  for (const job of result.afterReply) await job().catch((e) => console.error("after-reply job failed", e));
}
