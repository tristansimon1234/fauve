import "server-only";
import { awaitsAnswer, echoFor, emojiOnly, onboardingStepOf, replyExtrasSchema } from "@fauve/agent";
import { createLoginLink } from "@/lib/auth/login-link";
import { claimPairing } from "@/lib/auth/pairing";
import { answerPublishOffer } from "@/lib/publish-offer";
import { deliverPendingHandOffs } from "@/lib/social/hand-off";
import { replyInConversation } from "@/lib/agent/conversation";
import { quoteButtons } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureTranscript } from "@/lib/voice";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";
import { setReaction } from "@/lib/reactions";
import { env } from "@/lib/env";
import { downloadMedia, markReadAndTyping, sendLinkButton, sendReaction, sendReply, sendText } from "./client";
import { mediaOf, textOf, toE164, type InboundMessage } from "./schema";

// Several messages often arrive together (a caption + 5 clips). We wait briefly and
// let only the latest message of the burst run the agent, which sees them all.
const BURST_DEBOUNCE_MS = 4000;

const TECHNICAL_ISSUE_REPLY =
  "Petit souci technique de mon côté, je n’ai pas pu traiter ton message. Réessaie dans quelques minutes, désolé !";

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
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "application/pdf": "pdf",
};

async function storeMedia(studioId: string, message: InboundMessage): Promise<{ id: string; isVideo: boolean; isImage: boolean } | null> {
  const ref = mediaOf(message);
  if (!ref) return null;
  const db = supabaseAdmin();
  const file = await downloadMedia(ref.id);
  // A voice note comes as « audio/ogg; codecs=opus »: the type without its parameters names the file.
  const ext = extensionByMime[file.mimeType.split(";")[0]!.trim().toLowerCase()] ?? "bin";
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
  return { id: asset.data.id as string, isVideo: ref.kind === "video" || file.mimeType.startsWith("video/"), isImage: file.mimeType.startsWith("image/") };
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
      ? `Bonjour${member.first_name ? ` ${member.first_name}` : ""} ! Moi c’est Simone, ton community manager (une IA) ✨ Ton ordinateur est connecté : on fait connaissance sur l’écran, je t’y attends. Tu pourras m’écrire ici aussi, à tout moment.`
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
  // A voice note: Simone reads what she said (and it can go over a Reel, word by word).
  if (media && message.type === "audio") {
    const transcript = await ensureTranscript(member.studio_id, media.id);
    if (transcript?.text) await db.from("whatsapp_messages").update({ body: transcript.text }).eq("wa_message_id", message.id);
  }

  // Watching a clip takes up to a minute: acknowledge it now (👍 = reçu), then start
  // the analysis right away so whoever answers finds it ready.
  if (media?.isVideo) {
    await sendReaction(message.from, message.id, "👍")
      .then(() => setReaction({ waMessageId: message.id }, "fauve", "👍"))
      .catch((e) => console.warn("reaction failed", e));
  }
  const analysis = media?.isVideo
    ? ensureClipAnalysis(member.studio_id, media.id).catch((e) => console.error("clip analysis failed", e))
    : media?.isImage
      ? photoRegions(member.studio_id, media.id).catch((e) => console.warn("photo read failed", e))
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

  // « Oui, publie-le » / « Je regarde d’abord » under a delivered Reel (or the draft_ready
  // template's buttons): answered at once, no turn needed.
  if (text) {
    const { data: last } = await db
      .from("whatsapp_messages")
      .select("payload")
      .eq("studio_id", member.studio_id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const offer = await answerPublishOffer(member.studio_id, text, last, { waId: message.from }).catch((e) => {
      console.error("publish offer answer failed", e);
      return null;
    });
    if (offer) {
      const waMessageId = offer.link ? await sendLinkButton(message.from, offer.reply, offer.link) : await sendText(message.from, offer.reply);
      await db.from("whatsapp_messages").insert({
        studio_id: member.studio_id,
        wa_message_id: waMessageId,
        direction: "outbound",
        phone_e164: phone,
        type: "text",
        body: offer.body,
        payload: { reply_to: message.id, ...offer.payload },
      });
      return;
    }
  }

  await replyOnWhatsApp({ studioId: member.studio_id, memberId: member.id, waId: message.from, phone, replyTo: message.id });
}

/** Whether she sent another message after this one (on WhatsApp, its own turn answers it). */
async function newerMessage(studioId: string, waMessageId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: mine } = await db.from("whatsapp_messages").select("created_at").eq("wa_message_id", waMessageId).maybeSingle();
  if (!mine) return false;
  const { data: later } = await db
    .from("whatsapp_messages")
    .select("id")
    .eq("studio_id", studioId)
    .eq("channel", "whatsapp")
    .eq("direction", "inbound")
    .neq("type", "reaction")
    .is("payload->>via", null)
    .gt("created_at", mine.created_at as string)
    .limit(1);
  return Boolean(later?.length);
}

/**
 * Simone's turn on WhatsApp: her answer, with its buttons and links, sent and stored, then
 * what runs after it (a render…). Also after files dropped through her upload link (lib/upload-link.ts).
 */
export async function replyOnWhatsApp({ studioId, memberId, waId, phone, replyTo }: { studioId: string; memberId: string; waId: string; phone: string; replyTo?: string }): Promise<void> {
  const db = supabaseAdmin();
  let result: Awaited<ReturnType<typeof replyInConversation>>;
  try {
    result = await replyInConversation({ studioId, memberId, waId, replyToMessageId: replyTo });
  } catch (error) {
    // Never leave the manager on a "typing…" that leads nowhere. Not stored, so
    // the conversation history stays clean for the next attempt.
    console.error("agent failed, sending fallback reply", error);
    await sendText(waId, TECHNICAL_ISSUE_REPLY).catch((e) => console.error("fallback reply failed", e));
    return;
  }

  // She wrote again while this turn ran (a video, then « c'est envoyé ! » a few seconds later):
  // the newer turn reads both and answers them; two answers crossed and contradicted each other.
  // Only when this one started nothing (a montage, a post), which must be said.
  const superseded = replyTo && !result.afterReply.length && !result.notes.length ? await newerMessage(studioId, replyTo).catch(() => false) : false;
  if (result.reply && superseded) console.info("whatsapp: reply left to the newer turn", replyTo);
  if (result.reply && !superseded) {
    // The grid is the app's: never a link from WhatsApp, only the pages made for her phone.
    const { posts, quote } = result.extras;
    // A quote gets its yes / other level / no buttons, unless Fauve chose others.
    // The quote's own buttons win over the model's (they carry the other level).
    // (none for a montage already launched).
    const buttons = quote ? await quoteButtons(studioId, quote).catch(() => []) : [];
    const options = buttons.length ? buttons : result.extras.options;
    // Cards are app-only: on WhatsApp, a page made for her phone behind a button (no long link in her chat).
    // Files asked for (a drop zone or the library in the app): her own upload link, in full quality (WhatsApp compresses videos).
    const button =
      result.extras.link ??
      (result.extras.upload || result.extras.pick_media
        ? { path: "/depot", label: "Envoyer mes fichiers", purpose: "upload" as const }
        : posts?.length === 1
          ? { path: `/v/${posts[0]}`, label: "Voir la publication", purpose: "open_post" as const }
          : null);
    const url = button ? await createLoginLink(phone, button.path, button.purpose).catch((e: unknown) => void console.warn("button link failed", e)) : undefined;
    // Several posts: their pages, in text under the message.
    const links = [
      ...(posts && posts.length > 1 ? posts.map((id) => `${env("APP_URL")}/v/${id}`) : []),
      ...(!url && button ? [`${env("APP_URL")}${button.path}`] : []),
    ];
    const waMessageId = url
      ? options?.length
        ? // WhatsApp puts one kind of button on a message: the answers on hers, then the page.
          await sendReply(waId, result.reply, options, links).then(async (id) => {
            await sendLinkButton(waId, button!.purpose === "upload" ? "En pleine qualité, depuis ta galerie :" : "C’est ici :", { url, label: button!.label });
            return id;
          })
        : await sendLinkButton(waId, [result.reply, ...links].join("\n\n"), { url, label: button!.label })
      : await sendReply(waId, result.reply, options, links);
    await db.from("whatsapp_messages").insert({
      studio_id: studioId,
      wa_message_id: waMessageId,
      direction: "outbound",
      phone_e164: phone,
      type: "text",
      body: result.reply,
      payload: { ...(replyTo ? { reply_to: replyTo } : {}), ...result.extras, notes: result.notes },
    });
  }
  // E.g. a render: the video follows the "je monte ta vidéo" reply.
  for (const job of result.afterReply) await job().catch((e) => console.error("after-reply job failed", e));
}
