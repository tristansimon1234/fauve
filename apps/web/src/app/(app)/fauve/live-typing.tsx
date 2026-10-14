"use client";

import { MessageText } from "./chat-bubble";
import { liveParagraphs, type LiveState } from "./live-turn";

/**
 * Simone's bubbles while she answers: each paragraph appears whole, as a
 * bubble, the moment she has finished writing it (never letter by letter),
 * then the dots (or what she is doing: « Je regarde ton calendrier… ») while
 * the next one comes. The stored message takes their place, as is, at the end.
 */
export function LiveTyping({ live }: { live: LiveState | null }) {
  const { done } = liveParagraphs(live?.text ?? "");
  return (
    <div role="status" aria-live="polite" className="flex max-w-[85%] flex-col items-start gap-1 self-start">
      {done.map((part, i) => (
        <div key={i} className="fauve-enter max-w-full rounded-[18px] border border-line bg-white px-4 py-2.5 text-[15px] leading-[1.5] whitespace-pre-wrap wrap-break-word">
          <MessageText text={part} light={false} />
        </div>
      ))}
      <div className="fauve-enter flex items-center gap-2 rounded-[18px_18px_18px_6px] border border-line bg-white py-2 pr-4 pl-2.5 text-sm text-muted [--fauve-delay:120ms]">
        {/* Simone thinks in the header; here, what she is doing. */}
        <span className="fauve-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {/* key: each new line fades in */}
        {!done.length && (
          <span key={live?.status ?? "writing"} className="fauve-fade">
            {live?.status ?? "Simone écrit…"}
          </span>
        )}
      </div>
    </div>
  );
}
