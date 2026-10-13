"use client";

import { useState } from "react";
import { SmileIcon, WhatsAppIcon } from "@/components/icons";
import type { ChatMessage } from "./chat-actions";
import { ChatCards } from "./chat-cards";

// One message of the conversation with Fauve: text, media, cards, answer
// buttons and reactions. Shared by the Fauve page and the chat drawer.

const mediaLabels: Record<string, string> = {
  video: "Vidéo",
  image: "Photo",
  audio: "Message vocal",
  document: "Document",
  sticker: "Sticker",
};

const REACTIONS = ["👍", "❤️", "🔥", "😂", "😮", "🙏"];

export function Bubble({
  message,
  time,
  timezone,
  onReact,
  onChoose,
  onLaunch,
  busy,
}: {
  message: ChatMessage;
  time: string;
  timezone: string;
  onReact: (id: string, emoji: string) => void;
  onChoose?: (answer: string) => void;
  onLaunch: (quoteId: string) => void;
  busy: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const mine = message.from === "me";
  const media = mediaLabels[message.type];
  if (!message.body && !message.videoUrl && !media && !message.cards.length) return null;
  // A quote card carries its own buttons.
  const hasQuote = message.cards.some((c) => c.type === "quote");
  const options = onChoose && !mine && !hasQuote ? message.options : [];
  const reactions = [message.reactions.fauve, message.reactions.me].filter((e): e is string => Boolean(e));
  // Reacting is for Fauve's messages (the manager's own messages get Fauve's reactions).
  const canReact = !mine && !message.id.startsWith("local-");
  return (
    <div className={`group flex max-w-[85%] flex-col ${reactions.length ? "gap-4" : "gap-1"} ${mine ? "items-end self-end" : "items-start self-start"}`}>
      <div className={`relative flex items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        <div
          className={`relative flex flex-col gap-2 text-[15px] leading-[1.5] whitespace-pre-wrap ${message.media && !message.body ? "p-1" : "px-4 py-2.5"} ${
            mine ? "rounded-[18px_18px_6px_18px] bg-violet text-white" : "rounded-[18px_18px_18px_6px] border border-line bg-white"
          }`}
        >
          {message.videoUrl ? (
            <video src={message.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] w-[240px] max-w-full rounded-xl bg-ink" />
          ) : message.media ? (
            message.media.video ? (
              <video src={message.media.url} controls playsInline preload="metadata" className="max-h-[320px] w-[220px] max-w-full rounded-xl bg-ink object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.media.url} alt="" className="max-h-[320px] w-[220px] max-w-full rounded-xl object-cover" />
            )
          ) : (
            media && (
              <span className={`text-[13px] font-bold ${mine ? "text-white/85" : "text-muted"}`}>
                {media} envoyé{media === "Vidéo" || media === "Photo" ? "e" : ""}
              </span>
            )
          )}
          {message.body}
          {reactions.length > 0 && (
            // On the bubble's bottom corner, like WhatsApp.
            <span
              className={`absolute -bottom-3.5 flex items-center gap-0.5 rounded-full border border-line bg-white px-1.5 py-0.5 text-[14px] leading-none text-ink shadow-sm ${
                mine ? "left-2.5" : "right-2.5"
              }`}
              aria-label={`Réactions : ${reactions.join(" ")}`}
            >
              {reactions.map((emoji, i) => (
                <span key={i}>{emoji}</span>
              ))}
            </span>
          )}
        </div>
        {canReact && (
          <button
            type="button"
            aria-label="Réagir"
            aria-expanded={picking}
            onClick={() => setPicking((p) => !p)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted opacity-60 hover:bg-white hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <SmileIcon size={18} />
          </button>
        )}
        {picking && (
          <div className="absolute bottom-full left-0 z-10 mb-1.5 flex gap-0.5 rounded-full border border-line bg-white p-1 shadow-[0_8px_24px_rgba(28,21,48,0.12)]">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Réagir avec ${emoji}`}
                aria-pressed={message.reactions.me === emoji}
                onClick={() => {
                  setPicking(false);
                  onReact(message.id, emoji);
                }}
                className={`flex size-9 items-center justify-center rounded-full text-[20px] transition-transform hover:scale-110 hover:bg-soft ${
                  message.reactions.me === emoji ? "bg-violet-soft" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <ChatCards cards={message.cards} timezone={timezone} onLaunch={onLaunch} onAnswer={onChoose} busy={busy} />
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-0.5" role="group" aria-label="Réponses proposées">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChoose?.(option)}
              className="h-10 rounded-full border border-lilac bg-white px-4 text-[14px] font-semibold text-violet shadow-[0_2px_8px_rgba(28,21,48,0.05)] transition-colors hover:bg-violet hover:text-white"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <span className="flex items-center gap-1 px-1 text-[11px] text-muted">
        {message.channel === "whatsapp" && <WhatsAppIcon size={11} />}
        {mine ? "Toi" : "Fauve"} · {time}
      </span>
    </div>
  );
}
