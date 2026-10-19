import "server-only";
import { awaitsAnswer, echoFor, emojiOnly, segmentKind, editPlanSchema, type BriefQuestion } from "@fauve/agent";
import { after } from "next/server";
import { replyInConversation } from "@/lib/agent/conversation";
import { reactTo, type Reaction } from "@/lib/agent/mood";
import type { ChatEvent } from "@/lib/agent/run";
import { extrasOf, resolveCards, type ChatCard } from "@/lib/chat-cards";
import { answerPublishOffer } from "@/lib/publish-offer";
import { setReaction, type Reactions } from "@/lib/reactions";
import { getStudioContext, signMediaUrls } from "@/lib/studio";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureTranscript } from "@/lib/voice";
import { ensureClipAnalysis } from "@/lib/video/analyze";
import { photoRegions } from "@/lib/video/regions";

// The in-app chat, server side: conversations, their messages as the app shows
// them, and one turn (the manager's message, then Fauve's answer). Shared by the
// chat's Server Actions and the live route (api/chat/turn), which streams what
// Fauve is doing and her words as she writes them.

export type ChatMessage = {
  id: string;
  from: "me" | "fauve";
  channel: "whatsapp" | "web";
  type: string;
  body: string | null;
  at: string;
  videoUrl: string | null;
  /** A photo or video the manager sent (app or WhatsApp), with a fresh signed link. */
  media: { url: string; video: boolean } | null;
  reactions: Reactions;
  /** Answer buttons Fauve offered (reply_with). */
  options: string[];
  /** A drop zone Fauve offered for photos or videos (reply_with upload). */
  upload: "video" | "photo" | "any" | null;
  /** A picker of the library Fauve offered (reply_with pick_media). */
  pickMedia: "video" | "photo" | "any" | null;
  /** The card of an onboarding step Fauve offered (reply_with step_card). */
  stepCard?: "website" | "style" | "rhythm" | "connect" | "first_post" | null;
  /** Simone's questions before she makes something (reply_with questions), each with answers to tap. */
  questions?: BriefQuestion[];
  /** Post and grid cards under the message. */
  cards: ChatCard[];
  /** A delivered montage: the app opens this post's page when the message arrives. */
  openPost: string | null;
};

export type ConversationSummary = { id: string; title: string | null; lastAt: string };

const MESSAGES_PER_CONVERSATION = 200;
const CONVERSATIONS = 60;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function current(): Promise<{ studioId: string; memberId: string; phone: string } | null> {
  const { member } = await getStudioContext();
  return member ? { studioId: member.studio.id, memberId: member.id, phone: member.phone_e164 } : null;
}

export async function owns(studioId: string, conversationId: string): Promise<boolean> {
  if (!UUID.test(conversationId)) return false;
  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

export async function list(studioId: string): Promise<ConversationSummary[]> {
  const { data } = await supabaseAdmin()
    .from("conversations")
    .select("id, title, last_message_at")
    .eq("studio_id", studioId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false })
    .limit(CONVERSATIONS);
  return (data ?? []).map((c) => ({ id: c.id as string, title: (c.title as string | null) ?? null, lastAt: c.last_message_at as string }));
}

export async function messagesOf(studioId: string, conversationId: string): Promise<ChatMessage[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("whatsapp_messages")
    .select("id, direction, channel, type, body, created_at, payload, reactions, media_id")
    .eq("studio_id", studioId)
    .eq("conversation_id", conversationId)
    // A WhatsApp reaction is shown on the message it reacts to, not as a message.
    .neq("type", "reaction")
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PER_CONVERSATION);
  const rows = (data ?? []).reverse();

  // Montage videos: fresh signed links on every load, so they never expire in the chat.
  const renderIds = rows.flatMap((r) => {
    const id = (r.payload as { render_id?: string } | null)?.render_id;
    return id ? [id] : [];
  });
  const videos = new Map<string, string>();
  if (renderIds.length) {
    const { data: renders } = await db.from("renders").select("id, storage_path").eq("studio_id", studioId).in("id", renderIds);
    for (const r of renders ?? []) {
      const path = r.storage_path as string | null;
      if (!path?.startsWith(`${studioId}/`)) continue;
      const signed = await db.storage.from("media").createSignedUrl(path, 6 * 3600);
      if (signed.data) videos.set(r.id as string, signed.data.signedUrl);
    }
  }

  // Photos and videos the manager sent: thumbnails in the conversation.
  const mediaIds = rows.flatMap((r) => (r.media_id ? [r.media_id as string] : []));
  const sent = new Map<string, { url: string; video: boolean }>();
  if (mediaIds.length) {
    const { data: assets } = await db.from("media_assets").select("id, storage_path, kind, mime_type").eq("studio_id", studioId).in("id", mediaIds);
    const urls = await signMediaUrls(db, studioId, (assets ?? []).map((a) => a.storage_path as string));
    for (const a of assets ?? []) {
      const url = urls.get(a.storage_path as string);
      if (url) sent.set(a.id as string, { url, video: a.kind === "video" || String(a.mime_type ?? "").startsWith("video/") });
    }
  }

  const cards = await resolveCards(studioId, rows.map((r) => r.payload));

  return rows.map((r, i) => {
    const renderId = (r.payload as { render_id?: string } | null)?.render_id;
    const videoUrl = renderId ? (videos.get(renderId) ?? null) : null;
    const media = r.media_id ? (sent.get(r.media_id as string) ?? null) : null;
    const body = (r.body as string | null)
      ?.replace(/\n*Voir la vidéo : \S+/u, "")
      .replace(/^\[Vidéo envoyée[^\]]*\]\n?/u, "")
      .trim();
    return {
      id: r.id as string,
      from: r.direction === "inbound" ? "me" : "fauve",
      channel: r.channel === "web" ? "web" : "whatsapp",
      type: r.type as string,
      body: body || null,
      at: r.created_at as string,
      videoUrl,
      media,
      reactions: (r.reactions as Reactions | null) ?? {},
      options: r.direction === "outbound" ? (extrasOf(r.payload).options ?? []) : [],
      upload: r.direction === "outbound" ? (extrasOf(r.payload).upload ?? null) : null,
      pickMedia: r.direction === "outbound" ? (extrasOf(r.payload).pick_media ?? null) : null,
      stepCard: r.direction === "outbound" ? (extrasOf(r.payload).step_card ?? null) : null,
      questions: r.direction === "outbound" ? (extrasOf(r.payload).questions ?? []) : [],
      cards: cards[i] ?? [],
      openPost: r.direction === "outbound" ? ((r.payload as { open_post?: string } | null)?.open_post ?? null) : null,
    };
  });
}


export type ChatAbout = { postId: string; scene?: number };

/** A memo for Fauve on the manager's message: the publication (and scene) she is talking about. */
async function aboutMemo(studioId: string, about: ChatAbout): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts").select("id, title, kind, status, edit_plan_id").eq("id", about.postId).eq("studio_id", studioId).maybeSingle();
  if (!post) return null;
  let memo = `à propos de la publication « ${post.title as string} » (${post.kind as string}, statut ${post.status as string}) post_id=${post.id as string}`;
  if (about.scene !== undefined && post.edit_plan_id) {
    const { data: plan } = await db.from("edit_plans").select("plan").eq("id", post.edit_plan_id).maybeSingle();
    const parsed = editPlanSchema.safeParse(plan?.plan);
    const segment = parsed.success ? parsed.data.segments[about.scene] : undefined;
    if (parsed.success && segment) {
      const kind = segmentKind(segment);
      const what =
        "scene" in segment
          ? `écran « ${segment.scene.title} »`
          : "motion" in segment
            ? `animation (${Object.values(segment.motion.texts ?? {}).join(" / ") || segment.motion.brief.slice(0, 80)})`
            : `passage vidéo media_id=${(segment as { clip_id: string }).clip_id}`;
      memo += `, scène ${about.scene + 1} sur ${parsed.data.segments.length} (${kind}) : ${what}. Une demande sur cette scène est une correction du montage (montage avec correction: true)`;
    }
  }
  return memo;
}

/** The drawer's conversation about a publication: the latest one, if any. */

export type SendResult =
  | { ok: true; conversationId: string; messages: ChatMessage[]; conversations: ConversationSummary[] }
  | { ok: false; error: string; conversationId: string | null };

/** A photo or video the browser already uploaded to Storage under `<studio>/chat/`. */
export type Attachment = { path: string; mime: string; size: number };

const MAX_ATTACHMENTS = 10;

/**
 * Sends a message to Fauve: in `conversationId`, or in a new conversation when
 * null. Attachments become media of the studio (Médiathèque) and messages of
 * the conversation, like photos and videos sent on WhatsApp; videos are analysed.
 */
export async function chatTurn(
  text: string,
  conversationId: string | null,
  attachments: Attachment[] = [],
  /** From the drawer of a publication: the conversation is about it, and Fauve is told which one. */
  about?: ChatAbout,
  /** Live: what Fauve is doing and her words as she writes them (api/chat/turn). */
  onEvent?: (event: ChatEvent) => void,
): Promise<SendResult> {
  const ctx = await current();
  if (!ctx) return { ok: false, error: "Ton numéro n’est relié à aucun studio.", conversationId };
  const body = text.trim().slice(0, 4000);
  const files = attachments.slice(0, MAX_ATTACHMENTS);
  if (!body && !files.length) return { ok: false, error: "Message vide.", conversationId };
  // Her face (and an emoji) as early as possible: Jev reads the message while it is being stored
  // and while Claude starts, and the page gets it the moment it is known. Only emojis: no reading.
  const reading = body && !emojiOnly(body) ? readReaction(ctx.studioId, conversationId, body, onEvent) : null;
  const valid = files.every(
    (f) => f.path.startsWith(`${ctx.studioId}/chat/`) && !f.path.includes("..") && /^(image|video)\//.test(f.mime) && f.size > 0,
  );
  if (!valid) return { ok: false, error: "Un des fichiers n’est pas une photo ou une vidéo.", conversationId };

  const db = supabaseAdmin();
  let id = conversationId;
  if (id) {
    if (!(await owns(ctx.studioId, id))) return { ok: false, error: "Cette conversation n’existe plus.", conversationId: null };
  } else {
    const forPost = about && UUID.test(about.postId) ? about.postId : null;
    const created = await db.from("conversations").insert({ studio_id: ctx.studioId, started_by: "web", post_id: forPost }).select("id").single();
    if (created.error) return { ok: false, error: "Ton message n’est pas parti. Réessaie.", conversationId: null };
    id = created.data.id as string;
  }

  // One message per file (with its media_id, as on WhatsApp), then the text.
  let lastRowId: string | null = null;
  for (const file of files) {
    const video = file.mime.startsWith("video/");
    const audio = file.mime.startsWith("audio/");
    const kind = video ? "video" : audio ? "audio" : "image";
    const asset = await db
      .from("media_assets")
      .insert({ studio_id: ctx.studioId, storage_path: file.path, kind, source: "web_upload", mime_type: file.mime, size_bytes: file.size })
      .select("id")
      .single();
    if (asset.error) return { ok: false, error: "Un fichier n’a pas pu être ajouté. Réessaie.", conversationId: id };
    const mediaId = asset.data.id as string;
    // A voice note is read before Simone answers: she knows what it says.
    const transcript = audio ? await ensureTranscript(ctx.studioId, mediaId) : null;
    const row = await db
      .from("whatsapp_messages")
      .insert({ studio_id: ctx.studioId, conversation_id: id, channel: "web", direction: "inbound", phone_e164: ctx.phone, type: kind, media_id: mediaId, ...(transcript?.text ? { body: transcript.text } : {}) })
      .select("id")
      .single();
    if (row.error) return { ok: false, error: "Un fichier n’a pas pu être ajouté. Réessaie.", conversationId: id };
    lastRowId = row.data.id as string;
    // Watched once by Gemini, in the background: ready for the montage.
    if (video) after(() => ensureClipAnalysis(ctx.studioId, mediaId).then(() => undefined, (e) => console.error("chat: clip analysis failed", e)));
    // A photo is read once too (what it shows, its subject, any text on it): Simone and the editor know it before choosing.
    else if (kind === "image") after(() => photoRegions(ctx.studioId, mediaId).then(() => undefined, (e) => console.warn("chat: photo read failed", e)));
  }
  if (body) {
    const memo = about && UUID.test(about.postId) ? await aboutMemo(ctx.studioId, about) : null;
    const inserted = await db
      .from("whatsapp_messages")
      .insert({
        studio_id: ctx.studioId,
        conversation_id: id,
        channel: "web",
        direction: "inbound",
        phone_e164: ctx.phone,
        type: "text",
        body,
        ...(memo ? { payload: { notes: [memo] } } : {}),
      })
      .select("id")
      .single();
    if (inserted.error) return { ok: false, error: "Ton message n’est pas parti. Réessaie.", conversationId: id };
    lastRowId = inserted.data.id as string;
  }

  // Only emojis (« 🔥 », « ❤️ ») that answer nothing: Fauve reacts back at once, no turn needed.
  if (!files.length && lastRowId && emojiOnly(body)) {
    const echo = echoFor(body);
    const { data: last } = await db
      .from("whatsapp_messages")
      .select("body, payload")
      .eq("conversation_id", id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const extras = extrasOf(last?.payload);
    if (echo && !awaitsAnswer(last ? { body: last.body as string | null, options: extras.options, quote: Boolean(extras.quote), upload: extras.upload ?? extras.pick_media } : null)) {
      await setReaction({ id: lastRowId }, "fauve", echo);
      const [messages, conversations] = await Promise.all([messagesOf(ctx.studioId, id), list(ctx.studioId)]);
      return { ok: true, conversationId: id, messages, conversations };
    }
  }

  // Her face and an emoji on the message, in a fraction of a second (Jev), while the chat model writes.
  // The emoji is kept on her message once both are there.
  const reacting = reading && lastRowId ? keepReaction(reading, lastRowId) : null;

  // « Oui, publie-le » / « Je regarde d’abord » under a delivered Reel: answered at once, no turn needed.
  if (!files.length && body) {
    const { data: last } = await db
      .from("whatsapp_messages")
      .select("payload")
      .eq("conversation_id", id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const offer = await answerPublishOffer(ctx.studioId, body, last, {}).catch((e) => {
      console.error("chat: publish offer answer failed", e);
      return null;
    });
    if (offer) {
      await db.from("whatsapp_messages").insert({ studio_id: ctx.studioId, conversation_id: id, channel: "web", direction: "outbound", type: "text", body: offer.body, payload: offer.payload });
      await reacting;
      const [messages, conversations] = await Promise.all([messagesOf(ctx.studioId, id), list(ctx.studioId)]);
      return { ok: true, conversationId: id, messages, conversations };
    }
  }

  try {
    const result = await replyInConversation({
      studioId: ctx.studioId,
      memberId: ctx.memberId,
      conversationId: id,
      reactToRowId: lastRowId ?? undefined,
      onEvent,
    });
    if (result.reply) {
      await db.from("whatsapp_messages").insert({
        studio_id: ctx.studioId,
        conversation_id: id,
        channel: "web",
        direction: "outbound",
        type: "text",
        body: result.reply,
        payload: { ...result.extras, notes: result.notes },
      });
    }
    // E.g. a montage or a retouch: run after the answer is back on screen; the result shows up in the chat when it is ready.
    after(async () => {
      for (const job of result.afterReply) await job().catch((e) => console.error("chat: after-reply job failed", e));
    });
  } catch (error) {
    console.error("chat: agent failed", error);
    return { ok: false, error: "Simone n’a pas pu répondre. Réessaie dans un instant.", conversationId: id };
  }
  await reacting;
  const [messages, conversations] = await Promise.all([messagesOf(ctx.studioId, id), list(ctx.studioId)]);
  return { ok: true, conversationId: id, messages, conversations };
}

/** Simone's reaction to the manager's message, sent to the page the moment Jev answers. */
async function readReaction(studioId: string, conversationId: string | null, body: string, onEvent?: (event: ChatEvent) => void) {
  const started = Date.now();
  // Her previous message helps read a joke or a reply; only from this studio's conversation.
  const previous = conversationId
    ? await supabaseAdmin()
        .from("whatsapp_messages")
        .select("body")
        .eq("studio_id", studioId)
        .eq("conversation_id", conversationId)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => (data?.body as string | null) ?? null, () => null)
    : null;
  const reaction = await reactTo(studioId, body, previous);
  onEvent?.({ type: "mood", mood: reaction.mood, emoji: reaction.emoji });
  console.info("instant reaction", { by: reaction.by, ms: Date.now() - started, mood: reaction.mood, emoji: reaction.emoji });
  return reaction;
}

async function keepReaction(reading: Promise<Reaction>, rowId: string) {
  const reaction = await reading;
  if (reaction.emoji) await setReaction({ id: rowId }, "fauve", reaction.emoji);
}
