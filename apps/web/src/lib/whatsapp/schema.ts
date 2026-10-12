import { z } from "zod";

// Subset of the WhatsApp Cloud API webhook payload that Fauve uses.
// Unknown fields are ignored; unknown message types fall through as "unsupported".

const mediaSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
});

export const inboundMessageSchema = z.object({
  id: z.string(),
  from: z.string().regex(/^\d{6,15}$/),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  image: mediaSchema.optional(),
  video: mediaSchema.optional(),
  document: mediaSchema.optional(),
  audio: mediaSchema.optional(),
  sticker: mediaSchema.optional(),
  reaction: z.object({ message_id: z.string(), emoji: z.string().optional() }).optional(),
  button: z.object({ text: z.string(), payload: z.string().optional() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
});
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

export const webhookPayloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messaging_product: z.literal("whatsapp").optional(),
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            contacts: z
              .array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() }))
              .optional(),
            messages: z.array(inboundMessageSchema).optional(),
            statuses: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
          }),
        }),
      ),
    }),
  ),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export function toE164(waId: string): string {
  return `+${waId.replace(/\D/g, "")}`;
}

export type MediaRef = { id: string; mimeType?: string; caption?: string; filename?: string; kind: "video" | "image" | "audio" | "document" };

export function mediaOf(message: InboundMessage): MediaRef | null {
  const { image, video, document, audio } = message;
  if (video) return { kind: "video", id: video.id, mimeType: video.mime_type, caption: video.caption };
  if (image) return { kind: "image", id: image.id, mimeType: image.mime_type, caption: image.caption };
  if (audio) return { kind: "audio", id: audio.id, mimeType: audio.mime_type };
  if (document) {
    // Clips sent "as document" keep their full quality: classify them by MIME type.
    const mime = document.mime_type ?? "";
    const kind = mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "document";
    return { kind, id: document.id, mimeType: document.mime_type, caption: document.caption, filename: document.filename };
  }
  return null;
}

/** Plain-text view of a message for storage and for the agent. */
export function textOf(message: InboundMessage): string | null {
  if (message.text) return message.text.body;
  if (message.button) return message.button.text;
  if (message.interactive?.button_reply) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply) return message.interactive.list_reply.title;
  const media = mediaOf(message);
  if (media?.caption) return media.caption;
  return null;
}
