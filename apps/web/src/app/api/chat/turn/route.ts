import { z } from "zod";
import { chatTurn, type SendResult } from "@/lib/chat";

// One chat turn, live: the app posts the manager's message here (not through a
// Server Action, which the browser runs one at a time and cannot stream) and
// reads one JSON event per line while Fauve works: a line per tool she calls,
// her words as she writes them, then the stored conversation. The turn goes to
// its end even if the page closes.
export const maxDuration = 300;

const bodySchema = z.object({
  text: z.string().max(4000),
  conversationId: z.uuid().nullable(),
  attachments: z.array(z.object({ path: z.string().max(400), mime: z.string().max(100), size: z.number().int().positive() })).max(20).default([]),
  about: z.object({ postId: z.uuid(), scene: z.number().int().min(0).max(30).optional() }).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid message" }, { status: 400 });
  const { text, conversationId, attachments, about } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false; // The page went away: the turn still ends and is stored.
        }
      };
      // Some browsers hold the first kilobyte of a stream: start with one, so the first event shows at once.
      send({ type: "hello", pad: " ".repeat(1024) });
      let result: SendResult;
      try {
        result = await chatTurn(text, conversationId, attachments, about, send);
      } catch (error) {
        console.error("chat turn failed", error);
        result = { ok: false, error: "Simone n’a pas pu répondre. Réessaie dans un instant.", conversationId };
      }
      send({ type: "done", result });
      if (open) controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  });
}
