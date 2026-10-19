"use client";

import { emojiOnly, type Effort } from "@fauve/agent";
import { useState, type CSSProperties } from "react";
import { SmileIcon, WhatsAppIcon } from "@/components/icons";
import type { ChatMessage } from "./chat-actions";
import { ChatCards } from "./chat-cards";
import { DropCard } from "./drop-card";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { MediaPickCard } from "./media-pick-card";

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

const URL_RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)»])/g;

/** A link as a reader sees it: host and path, short. */
function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const label = `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
    return label.length > 32 ? `${label.slice(0, 31)}…` : label;
  } catch {
    return url;
  }
}

/** A message's text with its links clickable. */
export function MessageText({ text, light }: { text: string; light: boolean }) {
  const pieces = text.split(URL_RE);
  return (
    <span>
      {pieces.map((piece, i) =>
        i % 2 === 1 ? (
          <a key={i} href={piece} target="_blank" rel="noreferrer" className={`font-semibold underline underline-offset-2 ${light ? "text-white" : "text-violet"}`}>
            {linkLabel(piece)}
          </a>
        ) : (
          piece
        ),
      )}
    </span>
  );
}

export function Bubble({
  message,
  time,
  timezone,
  onReact,
  onChoose,
  onFiles,
  onAsk,
  onLaunch,
  opening = null,
  busy,
  enter = false,
}: {
  message: ChatMessage;
  time: string;
  timezone: string;
  onReact: (id: string, emoji: string) => void;
  onChoose?: (answer: string) => void;
  /** Files dropped on the drop zone Fauve offered (only on her latest message). */
  onFiles?: (files: FileList | File[]) => void;
  /** Asks Fauve something from a card, on any message (an expired quote, a late montage). */
  onAsk?: (text: string) => void;
  onLaunch: (quoteId: string, effort?: Effort) => Promise<string | null>;
  /** The post the app is about to open (a montage just delivered). */
  opening?: string | null;
  busy: boolean;
  /** Just arrived: rises in, its cards and buttons a beat later. */
  enter?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  // The manager's own reaction pops when she changes it, not when the conversation loads.
  const [firstReaction] = useState(message.reactions.me);
  // Fauve's reaction pops when it arrives (an instant answer to an emoji), not when the conversation loads.
  const [firstFauve] = useState(message.reactions.fauve);
  const mine = message.from === "me";
  const parts = shown(message.body ?? "", mine).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) parts.push("");
  const media = mediaLabels[message.type];
  if (!message.body && !message.videoUrl && !media && !message.cards.length) return null;
  // A quote card carries its own buttons.
  const hasQuote = message.cards.some((c) => c.type === "quote");
  const options = onChoose && !mine && !hasQuote ? message.options : [];
  const reactions = [message.reactions.fauve, message.reactions.me].filter((e): e is string => Boolean(e));
  // Reacting is for Fauve's messages (the manager's own messages get Fauve's reactions).
  const canReact = !mine && !message.id.startsWith("local-");
  return (
    <div
      className={`group flex ${hasQuote ? "max-w-full" : "max-w-[85%]"} flex-col ${reactions.length ? "gap-4" : "gap-1"} ${mine ? "items-end self-end" : "items-start self-start"} ${
        enter ? "fauve-enter" : ""
      }`}
    >
      <div className={`relative flex items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
        {/* A long answer reads as a few short bubbles, one per paragraph, arriving one after the other. */}
        <div className={`flex min-w-0 flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
          {parts.map((part, i) => {
            const first = i === 0;
            const last = i === parts.length - 1;
            const bigEmoji = parts.length === 1 && !message.media && !message.videoUrl && emojiOnly(part) && [...part.matchAll(/\p{Extended_Pictographic}/gu)].length <= 3;
            const corner = mine ? (last ? "rounded-[18px_18px_6px_18px]" : "rounded-[18px]") : last ? "rounded-[18px_18px_18px_6px]" : "rounded-[18px]";
            return (
              <div
                key={i}
                className={`relative flex max-w-full flex-col gap-2 leading-[1.5] whitespace-pre-wrap wrap-break-word ${
                  bigEmoji
                    ? "px-1 text-[40px] leading-none"
                    : `text-[15px] ${first && message.media && !message.body ? "p-1" : "px-4 py-2.5"} ${corner} ${mine ? "bg-violet text-white" : "border border-line bg-white"}`
                } ${enter && i > 0 ? "fauve-enter" : ""}`}
                style={enter && i > 0 ? ({ "--fauve-delay": `${Math.min(i * 380, 1200)}ms` } as CSSProperties) : undefined}
              >
                {first &&
                  (message.videoUrl ? (
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
                  ))}
                {part && <MessageText text={part} light={mine} />}
                {last && reactions.length > 0 && (
                  // On the last bubble's bottom corner, like WhatsApp.
                  <span
                    key={reactions.join("")}
                    className={`absolute -bottom-3.5 flex items-center gap-0.5 rounded-full border border-line bg-white px-1.5 py-0.5 text-[14px] leading-none text-ink shadow-sm ${
                      mine ? "left-2.5 [--fauve-origin:top_left]" : "right-2.5 [--fauve-origin:top_right]"
                    } ${message.reactions.me !== firstReaction || message.reactions.fauve !== firstFauve ? "fauve-pop [--fauve-scale:0.6]" : ""}`}
                    aria-label={`Réactions : ${reactions.join(" ")}`}
                  >
                    {reactions.map((emoji, j) => (
                      <span key={j}>{emoji}</span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
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
          <div className="fauve-pop absolute bottom-full left-0 z-10 mb-1.5 flex gap-0.5 rounded-full border border-line bg-white p-1 shadow-[0_8px_24px_rgba(28,21,48,0.12)] [--fauve-origin:bottom_left]">
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
                className={`flex size-9 items-center justify-center rounded-full text-[20px] transition-transform duration-150 ease-fauve hover:scale-110 hover:bg-soft motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                  message.reactions.me === emoji ? "bg-violet-soft" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <ChatCards
        cards={message.cards}
        timezone={timezone}
        onLaunch={onLaunch}
        onAnswer={onChoose}
        onAsk={onAsk}
        opening={opening}
        busy={busy}
        className={enter ? "fauve-enter [--fauve-delay:80ms]" : ""}
      />
      {onFiles && onChoose && !mine && message.pickMedia && (
        <MediaPickCard kind={message.pickMedia} onPick={onChoose} onFiles={onFiles} className={enter ? "fauve-enter [--fauve-delay:140ms]" : ""} />
      )}
      {onChoose && !mine && message.stepCard && (
        <OnboardingCard step={message.stepCard} timezone={timezone} onSend={onChoose} onFiles={onFiles} className={enter ? "fauve-enter [--fauve-delay:140ms]" : ""} />
      )}
      {/* The step card has its own drop zone: never a second one under it. */}
      {onFiles && !mine && message.upload && !message.pickMedia && !message.stepCard && <DropCard kind={message.upload} onFiles={onFiles} className={enter ? "fauve-enter [--fauve-delay:140ms]" : ""} />}
      {options.length > 0 && (
        <div className={`flex flex-wrap gap-2 pt-0.5 ${enter ? "fauve-enter [--fauve-delay:140ms]" : ""}`} role="group" aria-label="Réponses proposées">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChoose?.(option)}
              className="fauve-press h-10 rounded-full border border-lilac bg-white px-4 text-[14px] font-semibold text-violet shadow-[0_2px_8px_rgba(28,21,48,0.05)] hover:bg-violet hover:text-white"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      <span className="flex items-center gap-1 px-1 text-[11px] text-muted">
        {message.channel === "whatsapp" && <WhatsAppIcon size={11} />}
        {mine ? "Toi" : "Simone"} · {time}
      </span>
    </div>
  );
}

/** Her message as she reads it: the ids written for Simone (files, components) stay out of sight. */
function shown(body: string, mine: boolean): string {
  if (!mine) return body;
  return body
    .replace(/Fichiers choisis dans la médiathèque \(media_id, dans l’ordre\) : ([^\n]+?)\.(?=\n|$)/g, (_, ids: string) => {
      const n = ids.split(",").length;
      return `${n} fichier${n > 1 ? "s" : ""} choisi${n > 1 ? "s" : ""} dans ma médiathèque.`;
    })
    .replace(/ \((?:element_id|media_id)[^)]*\)/g, "");
}
