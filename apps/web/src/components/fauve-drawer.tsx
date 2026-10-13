"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { Bubble } from "@/app/(app)/fauve/chat-bubble";
import {
  launchQuote,
  loadConversation,
  openPostChat,
  reactToMessage,
  sendToFauve,
  type ChatAbout,
  type ChatMessage,
} from "@/app/(app)/fauve/chat-actions";
import { ArrowUpIcon, XIcon } from "./icons";
import { Orb } from "./orb";

// Fauve's chat as a side panel, over any page of the app, about one
// publication (and maybe one scene of its montage): the manager asks for a
// change without leaving what she is looking at, and Fauve knows what it is about.

export type DrawerTopic = ChatAbout & { title: string; sceneLabel?: string };

const DrawerContext = createContext<(topic: DrawerTopic) => void>(() => {});

/** Opens Fauve's side panel about a publication (or one of its scenes). */
export const useFauveDrawer = () => useContext(DrawerContext);

const POLL_MS = 8000;

export function FauveDrawerProvider({ children }: { children: React.ReactNode }) {
  const [topic, setTopic] = useState<DrawerTopic | null>(null);
  return (
    <DrawerContext.Provider value={setTopic}>
      {children}
      {topic && <FauveDrawer key={`${topic.postId}-${topic.scene ?? ""}`} topic={topic} onClose={() => setTopic(null)} />}
    </DrawerContext.Provider>
  );
}

/** The button that opens the panel: « Demander à Fauve », about this publication or scene. */
export function AskFauveButton({
  topic,
  label = "Demander à Fauve",
  className = "btn btn-secondary",
}: {
  topic: DrawerTopic;
  label?: string;
  className?: string;
}) {
  const open = useFauveDrawer();
  return (
    <button type="button" onClick={() => open(topic)} className={className}>
      <Orb size={18} still />
      {label}
    </button>
  );
}

function suggestionsFor(topic: DrawerTopic): string[] {
  if (topic.scene !== undefined) return ["Refais cette scène", "Change le texte de cette scène", "Raccourcis cette scène", "Enlève cette scène"];
  return ["Change l’accroche", "Réécris la légende", "Fais une variante", "Décale-la à demain"];
}

function FauveDrawer({ topic, onClose }: { topic: DrawerTopic; onClose: () => void }) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

  useEffect(() => {
    let alive = true;
    openPostChat(topic.postId)
      .then((chat) => {
        if (!alive || !chat) return;
        setConversationId(chat.conversationId);
        setMessages(chat.messages);
        setTimezone(chat.timezone);
      })
      .catch(() => alive && setError("La conversation n’a pas pu être chargée."))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        inputRef.current?.focus();
      });
    return () => {
      alive = false;
    };
  }, [topic.postId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A montage or a correction finishes on its own: refresh, and the page shows the new version.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    if (!conversationId) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || pending) return;
      loadConversation(conversationId)
        .then((fresh) => {
          const current = messagesRef.current;
          if (!fresh || fresh.at(-1)?.id === current.at(-1)?.id) return;
          const known = new Set(current.map((m) => m.id));
          setMessages(fresh);
          if (fresh.some((m) => !known.has(m.id) && m.openPost)) router.refresh();
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, pending, router]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || pending) return;
      setDraft("");
      setError(null);
      setMessages((m) => [
        ...m,
        {
          id: `local-${Date.now()}`,
          from: "me",
          channel: "web",
          type: "text",
          body: text,
          at: new Date().toISOString(),
          videoUrl: null,
          media: null,
          reactions: {},
          options: [],
          cards: [],
          openPost: null,
        },
      ]);
      start(async () => {
        try {
          const res = await sendToFauve(text, conversationId, [], { postId: topic.postId, scene: topic.scene });
          if (res.ok) {
            setConversationId(res.conversationId);
            setMessages(res.messages);
          } else {
            setError(res.error);
            if (res.conversationId) setConversationId(res.conversationId);
          }
        } catch {
          setError("Ton message n’est pas parti. Vérifie ta connexion et réessaie.");
        }
      });
    },
    [conversationId, pending, topic.postId, topic.scene],
  );

  const launch = (quoteId: string) => {
    if (!conversationId || pending) return;
    start(async () => {
      const res = await launchQuote(quoteId, conversationId).catch(() => null);
      if (res?.ok) setMessages(res.messages);
      else setError(res && !res.ok ? res.error : "Le montage n’a pas pu démarrer.");
    });
  };

  const react = (id: string, emoji: string) => {
    const next = messages.find((m) => m.id === id)?.reactions.me === emoji ? null : emoji;
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, reactions: { ...m.reactions, me: next ?? undefined } } : m)));
    reactToMessage(id, next).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-ink/20" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Fauve"
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-white bg-[radial-gradient(ellipse_at_top_right,#efebff_0%,rgba(239,235,255,0)_55%)] shadow-[-12px_0_40px_rgba(28,21,48,0.14)]"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <Orb size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight">Fauve</p>
            <p className="truncate text-[12px] text-muted">
              {topic.title}
              {topic.sceneLabel ? ` · ${topic.sceneLabel}` : ""}
            </p>
          </div>
          {conversationId && (
            <a href={`/fauve?c=${conversationId}`} className="text-[12px] font-bold text-violet hover:underline">
              Tout l’historique
            </a>
          )}
          <button type="button" aria-label="Fermer" onClick={onClose} className="flex size-9 items-center justify-center rounded-full hover:bg-soft">
            <XIcon size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 px-4 py-5">
            {loading && <p className="self-center text-sm text-muted">Chargement…</p>}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col gap-3 pt-6 text-center">
                <p className="text-[15px] text-muted">
                  {topic.scene !== undefined ? "Qu’est-ce que tu veux changer dans cette scène ?" : "Qu’est-ce que tu veux changer ?"}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestionsFor(topic).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-lilac bg-white px-3.5 py-2 text-[13px] font-semibold text-violet hover:bg-violet hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <Bubble
                key={m.id}
                message={m}
                time={timeFormat.format(new Date(m.at))}
                timezone={timezone}
                onReact={react}
                onChoose={i === messages.length - 1 && !pending ? send : undefined}
                onLaunch={launch}
                busy={pending}
              />
            ))}
            {pending && (
              <div className="flex items-center gap-2 self-start rounded-[18px_18px_18px_6px] border border-line bg-white px-4 py-3 text-sm text-muted">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                </span>
                Fauve écrit…
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form
          className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          {error && <p role="alert" className="rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
          <div className="flex items-end gap-1 rounded-[26px] border border-line bg-white p-1.5 pl-4 focus-within:border-lilac">
            <label htmlFor="drawer-message" className="sr-only">
              Message à Fauve
            </label>
            <textarea
              id="drawer-message"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={topic.scene !== undefined ? "Ce que tu veux pour cette scène…" : "Ce que tu veux changer…"}
              className="max-h-[160px] min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted/70"
            />
            <button
              type="submit"
              aria-label="Envoyer"
              disabled={pending || !draft.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet text-white disabled:bg-chip disabled:text-muted"
            >
              <ArrowUpIcon />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
