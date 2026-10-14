"use client";

import type { Effort } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { Bubble } from "@/app/(app)/fauve/chat-bubble";
import { applyLive, liveTurn, type LiveState } from "@/app/(app)/fauve/live-turn";
import { BrigitteLive } from "@/app/(app)/fauve/brigitte-avatar";
import { LiveTyping } from "@/app/(app)/fauve/live-typing";
import { montageStep } from "@/app/(app)/fauve/chat-cards";
import { arrivals, chatSignature, mergeMessages, runningQuote, useQuoteProgress } from "@/app/(app)/fauve/chat-sync";
import {
  launchQuote,
  loadConversation,
  openPostChat,
  reactToMessage,
  type ChatAbout,
  type ChatMessage,
} from "@/app/(app)/fauve/chat-actions";
import { FileStrip, useChatUploads } from "@/app/(app)/fauve/chat-uploads";
import { ArrowUpIcon, PaperclipIcon, XIcon } from "./icons";
import { Mascot } from "./mascot";

// Fauve's chat as a side panel, over any page of the app, about one
// publication (and maybe one scene of its montage): the manager asks for a
// change without leaving what she is looking at, and Fauve knows what it is about.

export type DrawerTopic = ChatAbout & {
  title: string;
  sceneLabel?: string;
  /** A new publication (« Nouvelle publication »): the first message, sent with its photos and videos once they are uploaded. */
  start?: { text: string; files: File[] };
};

const DrawerContext = createContext<(topic: DrawerTopic) => void>(() => {});

/** Opens Fauve's side panel about a publication (or one of its scenes). */
export const useFauveDrawer = () => useContext(DrawerContext);

const POLL_MS = 8000;

export function FauveDrawerProvider({ children }: { children: React.ReactNode }) {
  const [topic, setTopic] = useState<DrawerTopic | null>(null);
  // Closing gives the focus back to what opened the panel (« Demander à Fauve »).
  const opener = useRef<HTMLElement | null>(null);
  const open = useCallback((next: DrawerTopic) => {
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    setTopic(next);
  }, []);
  const close = useCallback(() => {
    setTopic(null);
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }, []);
  return (
    <DrawerContext.Provider value={open}>
      {children}
      {topic && <FauveDrawer key={`${topic.postId}-${topic.scene ?? ""}`} topic={topic} onClose={close} />}
    </DrawerContext.Provider>
  );
}

/** The button that opens the panel: « Demander à Fauve », about this publication or scene. */
export function AskFauveButton({
  topic,
  label = "Demander à Brigitte",
  className = "btn btn-secondary",
}: {
  topic: DrawerTopic;
  label?: string;
  className?: string;
}) {
  const open = useFauveDrawer();
  return (
    <button type="button" onClick={() => open(topic)} className={className}>
      <Mascot size={22} still />
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
  // While Fauve answers: the line of what she is doing, then her words as she writes them.
  const [live, setLive] = useState<LiveState | null>(null);
  // Messages that just arrived rise in; the history that loads with the panel does not.
  const [arrived, setArrived] = useState<Set<string>>(() => new Set());
  const [launching, setLaunching] = useState(false);
  const [closing, setClosing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Photos and videos, like on the Fauve page: uploaded at once, sent with the message.
  const uploads = useChatUploads(studioId, setError);
  const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

  useEffect(() => {
    let alive = true;
    openPostChat(topic.postId)
      .then((chat) => {
        if (!alive || !chat) return;
        setConversationId(chat.conversationId);
        setMessages(chat.messages);
        setTimezone(chat.timezone);
        setStudioId(chat.studioId);
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

  // The history lands at the end at once; a new reply glides into view (CSS, off under reduced motion).
  // After a launch, the card's progress rather than the end.
  const jump = useRef(true);
  const focusQuote = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const typing = pending && !launching;
  useEffect(() => {
    const quote = focusQuote.current;
    focusQuote.current = null;
    const progress = quote ? scrollerRef.current?.querySelector<HTMLElement>(`[data-quote="${quote}"] [data-progress]`) : null;
    if (progress) progress.scrollIntoView({ block: "nearest", behavior: "auto" });
    else endRef.current?.scrollIntoView({ block: "end", behavior: jump.current ? "instant" : "auto" });
    if (messages.length) jump.current = false;
  }, [messages.length, typing]);

  // Slides out before unmounting; at once when the manager asked for less motion.
  const close = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // A montage or a correction finishes on its own: refresh (keeping what did not change, so no
  // video reloads), and the page behind shows the new version.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const refresh = useCallback(
    (id: string) => {
      loadConversation(id)
        .then((fresh) => {
          const current = messagesRef.current;
          if (!fresh || chatSignature(fresh) === chatSignature(current)) return;
          const known = new Set(current.map((m) => m.id));
          setArrived(arrivals(current, fresh));
          setMessages(mergeMessages(current, fresh));
          if (fresh.some((m) => !known.has(m.id) && m.openPost)) router.refresh();
        })
        .catch(() => {});
    },
    [router],
  );
  useEffect(() => {
    if (!conversationId) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || pending) return;
      refresh(conversationId);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, pending, refresh]);
  useQuoteProgress(messages, setMessages, () => {
    if (conversationId) refresh(conversationId);
  });
  const running = runningQuote(messages);

  const send = useCallback(
    (raw: string, withFiles = false) => {
      const text = raw.trim();
      const files = withFiles ? uploads.ready : [];
      if ((!text && !files.length) || pending || (withFiles && uploads.uploading)) return;
      const attachments = withFiles ? uploads.attachments() : [];
      if (withFiles) uploads.clear();
      setDraft("");
      setError(null);
      setLaunching(false);
      const at = new Date().toISOString();
      const local = (part: Partial<ChatMessage>, i: number): ChatMessage => ({
        id: `local-${Date.now()}-${i}`,
        from: "me",
        channel: "web",
        type: "text",
        body: null,
        at,
        videoUrl: null,
        media: null,
        reactions: {},
        options: [],
        upload: null,
        pickMedia: null,
        cards: [],
        openPost: null,
        ...part,
      });
      const locals = [
        ...files.map((f, i) => local({ type: f.video ? "video" : "image", media: { url: f.preview, video: f.video } }, i)),
        ...(text ? [local({ body: text }, files.length)] : []),
      ];
      setArrived(new Set(locals.map((m) => m.id)));
      setMessages((m) => [...m, ...locals]);
      start(async () => {
        try {
          setLive({ status: null, text: "", step: -1 });
          const res = await liveTurn({ text, conversationId, attachments, about: { postId: topic.postId, scene: topic.scene } }, (event) =>
            setLive((state) => applyLive(state ?? { status: null, text: "", step: -1 }, event)),
          );
          if (res.ok) {
            setConversationId(res.conversationId);
            setArrived(arrivals(messagesRef.current, res.messages));
            setMessages(mergeMessages(messagesRef.current, res.messages));
          } else {
            setError(res.error);
            if (res.conversationId) setConversationId(res.conversationId);
          }
        } catch {
          setError("Ton message n’est pas parti. Vérifie ta connexion et réessaie.");
        } finally {
          setLive(null);
        }
      });
    },
    [conversationId, pending, topic.postId, topic.scene, uploads],
  );

  // A new publication: its files go up with the panel's own uploads, then the first message leaves on its own.
  // (The panel that opens it keeps to the files the uploads accept: photos and videos under 50 Mo.)
  const first = useRef(topic.start ?? null);
  const queued = useRef(false);
  useEffect(() => {
    if (loading || !studioId || !first.current || queued.current) return;
    queued.current = true;
    if (first.current.files.length) uploads.addFiles(first.current.files);
  }, [loading, studioId, uploads]);
  useEffect(() => {
    const opening = first.current;
    if (!opening || !queued.current || pending) return;
    if (opening.files.length && (!uploads.files.length || uploads.uploading)) return;
    first.current = null;
    send(opening.text, opening.files.length > 0);
  }, [loading, pending, uploads.uploading, uploads.files.length, send]);

  // « Lancer » on a quote card: the card shows its own progress and error (the answer: the error, or null).
  const launch = (quoteId: string, effort?: Effort) =>
    new Promise<string | null>((resolve) => {
      if (!conversationId || pending) return resolve("Attends la fin du message en cours, puis relance.");
      setLaunching(true);
      start(async () => {
        const res = await launchQuote(quoteId, conversationId, effort).catch(() => null);
        if (res?.ok) {
          focusQuote.current = quoteId;
          setArrived(arrivals(messagesRef.current, res.messages));
          setMessages(mergeMessages(messagesRef.current, res.messages));
          resolve(null);
        } else resolve(res && !res.ok ? res.error : "Le montage n’a pas pu démarrer. Vérifie ta connexion et réessaie.");
      });
    });
  const ask = (text: string) => {
    if (!pending) send(text);
  };

  const react = (id: string, emoji: string) => {
    const next = messages.find((m) => m.id === id)?.reactions.me === emoji ? null : emoji;
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, reactions: { ...m.reactions, me: next ?? undefined } } : m)));
    reactToMessage(id, next).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fermer" onClick={close} data-closing={closing || undefined} className="fauve-fade absolute inset-0 bg-ink/20" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Brigitte"
        data-closing={closing || undefined}
        className="fauve-sheet absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-white bg-[radial-gradient(ellipse_at_top_right,#efebff_0%,rgba(239,235,255,0)_55%)] shadow-[-12px_0_40px_rgba(28,21,48,0.14)]"
        // Drop zone: photos and videos dropped anywhere on the panel.
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragging(false);
          uploads.addFiles(e.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className="fauve-fade pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-violet bg-violet-soft/90 text-center">
            <PaperclipIcon size={28} className="text-violet" />
            <p className="text-[16px] font-bold text-violet">Dépose tes photos et vidéos</p>
          </div>
        )}
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <BrigitteLive typing={typing} cue={null} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight">Brigitte</p>
            <p className="truncate text-[12px] text-muted">
              {topic.title}
              {topic.sceneLabel ? ` · ${topic.sceneLabel}` : ""}
            </p>
            {running && (
              <p key={montageStep(running)} className="fauve-fade truncate text-[12px] font-semibold text-violet">
                {montageStep(running)}
              </p>
            )}
          </div>
          {conversationId && (
            <a href={`/fauve?c=${conversationId}`} className="text-[12px] font-bold text-violet hover:underline">
              Tout l’historique
            </a>
          )}
          <button type="button" aria-label="Fermer" onClick={close} className="flex size-9 items-center justify-center rounded-full hover:bg-soft">
            <XIcon size={18} />
          </button>
        </header>

        <div ref={scrollerRef} className="fauve-scroll min-h-0 flex-1 overflow-y-auto">
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
                      className="fauve-press rounded-full border border-lilac bg-white px-3.5 py-2 text-[13px] font-semibold text-violet hover:bg-violet hover:text-white"
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
                onFiles={i === messages.length - 1 ? uploads.addFiles : undefined}
                onAsk={ask}
                onLaunch={launch}
                busy={pending}
                enter={arrived.has(m.id)}
              />
            ))}
            {typing && <LiveTyping live={live} />}
            <div ref={endRef} />
          </div>
        </div>

        <form
          className="flex flex-col gap-2 border-t border-line px-4 pt-3 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft, true);
          }}
        >
          {error && (
            <p role="alert" className="fauve-enter rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <FileStrip files={uploads.files} onRemove={uploads.removeFile} />
          <div className="flex items-end gap-1 rounded-[26px] border border-line bg-white p-1.5 pl-1.5 focus-within:border-lilac">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) uploads.addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Ajouter des photos ou des vidéos"
              title="Photos et vidéos"
              onClick={() => fileRef.current?.click()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink"
            >
              <PaperclipIcon size={20} />
            </button>
            <label htmlFor="drawer-message" className="sr-only">
              Message à Brigitte
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
                  send(draft, true);
                }
              }}
              placeholder={topic.scene !== undefined ? "Ce que tu veux pour cette scène…" : "Ce que tu veux changer, ou glisse une photo…"}
              // 16 px: iOS Safari does not zoom the page on focus.
              className="max-h-[160px] min-h-10 flex-1 resize-none bg-transparent py-2 text-[16px] outline-none placeholder:text-muted/70"
            />
            <button
              type="submit"
              aria-label="Envoyer"
              disabled={pending || uploads.uploading || (!draft.trim() && !uploads.ready.length)}
              className="fauve-press flex size-10 shrink-0 items-center justify-center rounded-full bg-violet text-white hover:bg-violet-hover disabled:bg-chip disabled:text-muted"
            >
              <ArrowUpIcon />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
