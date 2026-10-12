"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpIcon, WhatsAppIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { loadChat, sendToFauve, type ChatMessage } from "./chat-actions";

const mediaLabels: Record<string, string> = {
  video: "Vidéo",
  image: "Photo",
  audio: "Message vocal",
  document: "Document",
  sticker: "Sticker",
};

const POLL_MS = 8000;

export function FauveChat({ initial, timezone }: { initial: ChatMessage[]; timezone: string }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  // Montage videos and WhatsApp messages arrive on their own: refresh while the page is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || pending) return;
      loadChat()
        .then((fresh) => setMessages((current) => (fresh.length && fresh.at(-1)?.id !== current.at(-1)?.id ? fresh : current)))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [pending]);

  function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setError(null);
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, from: "me", channel: "web", type: "text", body: text, at: new Date().toISOString(), videoUrl: null },
    ]);
    startTransition(async () => {
      const res = await sendToFauve(text);
      if (res.ok) setMessages(res.messages);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-white">
      <div className="flex max-h-[62vh] min-h-[320px] flex-col gap-2.5 overflow-y-auto bg-chat p-4 sm:p-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Orb size={56} />
            <p className="max-w-[380px] text-sm text-muted">
              Écris à Fauve ici ou sur WhatsApp : c’est la même conversation. Demande un montage, un planning, un bilan…
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} time={timeFormat.format(new Date(m.at))} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 self-start rounded-[16px_16px_16px_4px] border border-line bg-white px-4 py-3 text-sm text-muted">
            <span className="flex gap-1" aria-hidden="true">
              <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted" />
            </span>
            Fauve écrit…
          </div>
        )}
        {error && (
          <p role="alert" className="self-center rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-line bg-white px-3 py-3 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="message-fauve" className="sr-only">
            Message à Fauve
          </label>
          <textarea
            id="message-fauve"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Écris à Fauve…"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-soft px-4 py-2.5 text-[15px] outline-none focus:border-violet"
          />
          <button
            type="submit"
            aria-label="Envoyer"
            disabled={pending || !draft.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet text-white disabled:opacity-50"
          >
            <ArrowUpIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ message, time }: { message: ChatMessage; time: string }) {
  const mine = message.from === "me";
  const media = mediaLabels[message.type];
  if (!message.body && !message.videoUrl && !media) return null;
  return (
    <div className={`flex max-w-[85%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"}`}>
      <div
        className={`flex flex-col gap-2 px-3.5 py-2.5 text-[15px] leading-[1.45] whitespace-pre-wrap ${
          mine ? "rounded-[16px_16px_4px_16px] bg-violet text-white" : "rounded-[16px_16px_16px_4px] border border-line bg-white"
        }`}
      >
        {message.videoUrl ? (
          <video src={message.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] w-[240px] max-w-full rounded-xl bg-ink" />
        ) : (
          media && (
            <span className={`text-[13px] font-bold ${mine ? "text-white/85" : "text-muted"}`}>
              {media} envoyé{media === "Vidéo" || media === "Photo" ? "e" : ""}
            </span>
          )
        )}
        {message.body}
      </div>
      <span className="flex items-center gap-1 px-1 text-[11px] text-muted">
        {message.channel === "whatsapp" && <WhatsAppIcon size={11} />}
        {mine ? "Toi" : "Fauve"} · {time}
      </span>
    </div>
  );
}
