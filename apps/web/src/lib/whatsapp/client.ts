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

/**
 * Fauve's reply with answer buttons: up to 3 short options as WhatsApp reply
 * buttons, up to 10 as a list; otherwise (or for a long reply) plain text.
 * The manager's tap comes back as a message whose text is the option.
 */
export async function sendReply(toWaId: string, body: string, options?: string[], links: string[] = []): Promise<string | undefined> {
  const text = [body, ...links].join("\n\n");
  if (!options?.length || text.length > 1024) {
    return sendText(toWaId, options?.length ? `${text}\n\n${options.join(" · ")}` : text);
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
