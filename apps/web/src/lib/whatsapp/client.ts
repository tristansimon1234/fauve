import "server-only";
import { env } from "@/lib/env";

// Thin wrapper over the WhatsApp Cloud API (Graph). Fauve sends from a single number.

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${env("WHATSAPP_GRAPH_VERSION")}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new WhatsAppError(`WhatsApp API ${res.status} on ${path}`, res.status, body);
  return body as T;
}

function sendMessage(payload: Record<string, unknown>) {
  return graph<{ messages: { id: string }[] }>(`${env("WHATSAPP_PHONE_ID")}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
}

/** Marks the message as read and shows "typing…" until we reply (max 25 s). */
export async function markReadAndTyping(messageId: string): Promise<void> {
  await sendMessage({ status: "read", message_id: messageId, typing_indicator: { type: "text" } });
}

export async function sendText(toWaId: string, body: string): Promise<string | undefined> {
  const res = await sendMessage({
    recipient_type: "individual",
    to: toWaId,
    type: "text",
    text: { body, preview_url: true },
  });
  return res.messages[0]?.id;
}

/** Bodies of WhatsApp's buttons and lists are 1024 characters at most. */
const INTERACTIVE_BODY = 1024;

/**
 * Fauve's reply with answer buttons: up to 3 short options as WhatsApp reply
 * buttons, up to 10 as a list; otherwise plain text. A reply too long for one (a
 * plan in points) sends its first paragraphs as text and keeps the buttons under
 * the last ones. The manager's tap comes back as a message whose text is the option.
 */
export async function sendReply(toWaId: string, body: string, options?: string[], links: string[] = []): Promise<string | undefined> {
  const text = [body, ...links].join("\n\n");
  if (!options?.length) return sendText(toWaId, text);
  if (text.length > INTERACTIVE_BODY) {
    const paragraphs = text.split(/\n{2,}/);
    let tail = paragraphs.pop()!;
    while (paragraphs.length && tail.length + 2 + paragraphs.at(-1)!.length <= INTERACTIVE_BODY) tail = `${paragraphs.pop()!}\n\n${tail}`;
    if (!paragraphs.length || tail.length > INTERACTIVE_BODY) return sendText(toWaId, `${text}\n\n${options.join(" · ")}`);
    await sendText(toWaId, paragraphs.join("\n\n"));
    return sendReply(toWaId, tail, options);
  }
  const interactive =
    options.length <= 3 && options.every((o) => o.length <= 20)
      ? {
          type: "button",
          body: { text },
          action: { buttons: options.map((title, i) => ({ type: "reply", reply: { id: `opt_${i}`, title } })) },
        }
      : {
          type: "list",
          body: { text },
          action: {
            button: "Choisir",
            sections: [{ title: "Réponses", rows: options.slice(0, 10).map((title, i) => ({ id: `opt_${i}`, title: title.slice(0, 24) })) }],
          },
        };
  try {
    const res = await sendMessage({ recipient_type: "individual", to: toWaId, type: "interactive", interactive });
    return res.messages[0]?.id;
  } catch (error) {
    // Never lose the reply over the buttons.
    console.warn("interactive reply refused, sending text", error instanceof WhatsAppError ? error.body : error);
    return sendText(toWaId, `${text}\n\n${options.join(" · ")}`);
  }
}

/** Labels on WhatsApp's URL buttons are 20 characters at most, bodies 1024. */
const CTA_LABEL = 20;
const CTA_BODY = 1024;

/**
 * A message with a page of the app behind a button (« Voir mon Reel »), as brands send them on
 * WhatsApp: no long link in her chat. Plain text with the link if WhatsApp refuses it.
 */
export async function sendLinkButton(toWaId: string, body: string, link: { url: string; label: string }): Promise<string | undefined> {
  const text = body.trim() || link.label;
  // Too long for one: the first paragraphs carry the button, the rest follows.
  const paragraphs = text.split(/\n{2,}/);
  let head = paragraphs[0]!;
  let i = 1;
  while (i < paragraphs.length && head.length + 2 + paragraphs[i]!.length <= CTA_BODY) head += `\n\n${paragraphs[i++]}`;
  const rest = paragraphs.slice(i).join("\n\n");
  if (head.length <= CTA_BODY) {
    try {
      const res = await sendMessage({
        recipient_type: "individual",
        to: toWaId,
        type: "interactive",
        interactive: { type: "cta_url", body: { text: head }, action: { name: "cta_url", parameters: { display_text: link.label.slice(0, CTA_LABEL), url: link.url } } },
      });
      if (rest) await sendText(toWaId, rest);
      return res.messages[0]?.id;
    } catch (error) {
      // Never lose the message over the button.
      console.warn("link button refused, sending text", error instanceof WhatsAppError ? error.body : error);
    }
  }
  return sendText(toWaId, `${text}\n\n👉 ${link.url}`);
}

/**
 * A message with its page behind a button, then its question with answer buttons: WhatsApp puts
 * one kind of button on a message. Without answers, one message. Returns the last one's id.
 */
export async function sendLinkThenReply(
  toWaId: string,
  body: string,
  link: { url: string; label: string },
  question?: string,
  options?: string[],
): Promise<string | undefined> {
  if (!options?.length || !question) return sendLinkButton(toWaId, [body, question].filter(Boolean).join("\n\n"), link);
  await sendLinkButton(toWaId, body, link);
  return sendReply(toWaId, question, options);
}

/** Sends a video by link (WhatsApp downloads it; max 16 MB) with a caption (max 1024 chars). */
export async function sendVideo(toWaId: string, link: string, caption?: string): Promise<string | undefined> {
  const res = await sendMessage({
    recipient_type: "individual",
    to: toWaId,
    type: "video",
    video: { link, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
  return res.messages[0]?.id;
}

/** Sends an image by link (JPEG or PNG, max 5 MB) with a caption (max 1024 chars). */
export async function sendImage(toWaId: string, link: string, caption?: string): Promise<string | undefined> {
  const res = await sendMessage({
    recipient_type: "individual",
    to: toWaId,
    type: "image",
    image: { link, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
  return res.messages[0]?.id;
}

export async function sendReaction(toWaId: string, messageId: string, emoji: string): Promise<void> {
  await sendMessage({
    recipient_type: "individual",
    to: toWaId,
    type: "reaction",
    reaction: { message_id: messageId, emoji },
  });
}

export async function sendTemplate(
  toWaId: string,
  name: string,
  params: string[],
  languageCode = "fr",
): Promise<string | undefined> {
  const res = await sendMessage({
    to: toWaId,
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      components: params.length
        ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
        : [],
    },
  });
  return res.messages[0]?.id;
}

/** Downloads an inbound media file (the URL from Graph is short-lived and needs the token). */
export async function downloadMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; mimeType: string; size: number }> {
  const meta = await graph<{ url: string; mime_type: string; file_size: number }>(mediaId);
  const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}` } });
  if (!res.ok) throw new WhatsAppError(`Media download failed (${res.status})`, res.status, null);
  return { bytes: await res.arrayBuffer(), mimeType: meta.mime_type, size: meta.file_size };
}

/** Sends a login code with the Meta "authentication" template (body + copy-code button). */
export async function sendLoginCode(toWaId: string, code: string): Promise<string | undefined> {
  const res = await sendMessage({
    to: toWaId,
    type: "template",
    template: {
      name: "login_code",
      language: { code: "fr" },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  });
  return res.messages[0]?.id;
}
