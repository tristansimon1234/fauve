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
