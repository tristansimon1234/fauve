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
  // A new step (after a tool call) goes on in a new paragraph: her reply keeps the words of every step.
  if (event.step === state.step) return { ...state, text: state.text + event.delta };
  return { ...state, step: event.step, text: state.text.trim() ? `${state.text.trimEnd()}\n\n${event.delta.trimStart()}` : event.delta };
}

/** Her paragraphs already written in full (a bubble each), and whether one is still being written. */
export function liveParagraphs(text: string): { done: string[]; writing: boolean } {
  const parts = text.split(/\n{2,}/).map((p) => p.trim());
  const closed = /\n{2,}\s*$/.test(text);
  const done = (closed ? parts : parts.slice(0, -1)).filter(Boolean);
  return { done, writing: !closed && Boolean(parts.at(-1)) };
}

/**
 * The turn's new messages that should enter with an animation: not her reply when
 * its first paragraphs are already on screen (written live), so nothing jumps.
 */
export function enteringAfterLive<M extends { id: string; from: string; body: string | null }>(fresh: Set<string>, messages: M[], live: LiveState | null): Set<string> {
  if (!live || !liveParagraphs(live.text).done.length) return fresh;
  const reply = messages.find((m) => fresh.has(m.id) && m.from === "fauve" && m.body);
  if (!reply) return fresh;
  const still = new Set(fresh);
  still.delete(reply.id);
  return still;
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
