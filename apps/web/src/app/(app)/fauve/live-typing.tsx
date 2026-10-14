"use client";

import { Mascot } from "@/components/mascot";
import type { LiveState } from "./live-turn";

/**
 * Fauve's bubble while she answers: what she is doing (« Je regarde ton
 * calendrier… »), then her words as she writes them. The stored message
 * replaces it when the turn ends.
 */
export function LiveTyping({ live }: { live: LiveState | null }) {
  const text = live?.text.trim();
  if (text) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fauve-enter max-w-[85%] self-start rounded-[18px_18px_18px_6px] border border-line bg-white px-4 py-2.5 text-[15px] leading-[1.5] whitespace-pre-wrap wrap-break-word"
      >
        {text}
        <span className="fauve-caret" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="fauve-enter flex items-center gap-2 self-start rounded-[18px_18px_18px_6px] border border-line bg-white py-2 pr-4 pl-2.5 text-sm text-muted [--fauve-delay:120ms]"
    >
      {/* Brigitte at work: she looks up, thinking. */}
      <Mascot size={30} mood="thinking" />
      {/* key: each new line fades in */}
      <span key={live?.status ?? "writing"} className="fauve-fade">
        {live?.status ?? "Brigitte écrit…"}
      </span>
    </div>
  );
}
