"use client";

import type { Attachment, ChatAbout, SendResult } from "./chat-actions";

// The client side of a live turn (api/chat/turn): posts the message, reads one
// event per line, and resolves with the stored conversation.

export type LiveState = { status: string | null; text: string; step: number };

export type LiveEvent =
  | { type: "status"; label: string }
  | { type: "text"; step: number; delta: string }
  /** Brigitte's instant reaction to the manager's message (her face, an emoji on it), before her answer. */
  | { type: "mood"; mood: "laugh" | "happy" | "surprised" | "sad" | "cry" | "neutral"; emoji: string | null };

/** What the « Fauve écrit » bubble shows after an event: the latest line, and the text of the step being written. */
export function applyLive(state: LiveState, event: LiveEvent): LiveState {
  if (event.type === "mood") return state;
  if (event.type === "status") return { ...state, status: event.label };
  // A new step starts over: what she wrote before a tool call was a preamble.
  return event.step === state.step ? { ...state, text: state.text + event.delta } : { ...state, step: event.step, text: event.delta };
}

export async function liveTurn(
  input: { text: string; conversationId: string | null; attachments: Attachment[]; about?: ChatAbout },
  onEvent: (event: LiveEvent) => void,
): Promise<SendResult> {
  const res = await fetch("/api/chat/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!res.ok || !res.body) throw new Error(`chat turn refused: ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: SendResult | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      const event = JSON.parse(line) as LiveEvent | { type: "hello" } | { type: "done"; result: SendResult };
      if (event.type === "done") result = event.result;
      else if (event.type !== "hello") onEvent(event);
    }
  }
  if (!result) throw new Error("chat turn interrupted");
  return result;
}
