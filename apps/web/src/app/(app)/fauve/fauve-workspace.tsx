"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUpIcon,
  BulbIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  FilmIcon,
  PaperclipIcon,
  PenIcon,
  PlayIcon,
  ReplyIcon,
  SmileIcon,
  TrashIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ChatCards } from "./chat-cards";
import {
  deleteConversation,
  launchQuote,
  listConversations,
  loadConversation,
  reactToMessage,
  sendToFauve,
  type Attachment,
  type ChatMessage,
  type ConversationSummary,
} from "./chat-actions";

/** A photo or video added to the composer: uploaded at once, sent with the next message. */
type DraftFile = { id: string; file: File; preview: string; video: boolean; status: "uploading" | "ready" | "error"; path?: string };

const MAX_FILES = 10;
// Supabase's default per-file limit; WhatsApp-quality phone clips fit well under it.
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type Suggestion = { icon: keyof typeof icons; label: string; prompt: string };

const icons = {
  film: FilmIcon,
  calendar: CalendarIcon,
  check: CheckIcon,
  bulb: BulbIcon,
  chart: ChartIcon,
  reply: ReplyIcon,
  pen: PenIcon,
};

const mediaLabels: Record<string, string> = {
  video: "Vidéo",
  image: "Photo",
  audio: "Message vocal",
  document: "Document",
  sticker: "Sticker",
};

const POLL_MS = 8000;

const EMOJIS = [
  "😊", "😂", "🥰", "😍", "🤩", "😎", "🙏", "👍",
  "👏", "🙌", "💪", "🔥", "✨", "💜", "❤️", "🧡",
  "🌿", "🌸", "☀️", "🌙", "🧘‍♀️", "🤸‍♀️", "💃", "🎉",
  "📅", "📸", "🎬", "✅", "👀", "🤔", "😮", "😅",
];
const LIST_POLL_MS = 30000;

/**
 * Fauve's home: conversations on the left, the open conversation (or a fresh
 * start with suggestions) in the middle, the composer pinned at the bottom.
 */
export function FauveWorkspace({
  studioId,
  firstName,
  summary,
  suggestions,
  whatsappHref,
  timezone,
  initialConversations,
  initialActive,
  initialMessages,
}: {
  studioId: string;
  firstName: string | null;
  summary: string;
  suggestions: Suggestion[];
  whatsappHref: string;
  timezone: string;
  initialConversations: ConversationSummary[];
  initialActive: string | null;
  initialMessages: ChatMessage[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [active, setActive] = useState(initialActive);
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

  // Photos and videos: uploaded to Storage as soon as they are added, sent with the message.
  const addFiles = (list: FileList | File[]) => {
    const picked = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!picked.length) return setError("Ajoute des photos ou des vidéos.");
    if (picked.some((f) => f.size > MAX_FILE_BYTES)) setError("Un fichier dépasse 50 Mo : envoie-le plutôt sur WhatsApp en tant que document.");
    const room = MAX_FILES - files.length;
    const added = picked
      .filter((f) => f.size <= MAX_FILE_BYTES)
      .slice(0, room)
      .map((file): DraftFile => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        video: file.type.startsWith("video/"),
        status: "uploading",
      }));
    if (!added.length) return;
    setFiles((current) => [...current, ...added]);
    const storage = supabaseBrowser().storage.from("media");
    for (const draft of added) {
      const ext = draft.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (draft.video ? "mp4" : "jpg");
      const path = `${studioId}/chat/${draft.id}.${ext}`;
      storage
        .upload(path, draft.file, { contentType: draft.file.type })
        .then(({ error: uploadError }) =>
          setFiles((current) => current.map((f) => (f.id === draft.id ? { ...f, status: uploadError ? "error" : "ready", path } : f))),
        );
    }
  };
  const removeFile = (id: string) =>
    setFiles((current) => {
      const gone = current.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((f) => f.id !== id);
    });
  const uploading = files.some((f) => f.status === "uploading");

  // Keep the open conversation in the URL, so a reload lands on it.
  useEffect(() => {
    window.history.replaceState(null, "", active ? `?c=${active}` : window.location.pathname);
  }, [active]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  // Montage videos and WhatsApp messages arrive on their own: refresh while visible.
  // A montage that just got delivered opens its publication page.
  const router = useRouter();
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || pending) return;
      loadConversation(active)
        .then((fresh) => {
          const current = messagesRef.current;
          if (!fresh || fresh.at(-1)?.id === current.at(-1)?.id) return;
          const known = new Set(current.map((m) => m.id));
          const delivered = fresh.find((m) => !known.has(m.id) && m.openPost);
          setMessages(fresh);
          if (delivered?.openPost) router.push(`/publications/${delivered.openPost}`);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, pending, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") listConversations().then(setConversations).catch(() => {});
    }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const startNew = useCallback(() => {
    setActive(null);
    setMessages([]);
    setError(null);
    setShowList(false);
    inputRef.current?.focus();
  }, []);

  const open = (id: string) => {
    setShowList(false);
    if (id === active) return;
    setActive(id);
    setMessages([]);
    setError(null);
    setLoading(true);
    loadConversation(id)
      .then((loaded) => {
        if (loaded) setMessages(loaded);
        else {
          setConversations((list) => list.filter((c) => c.id !== id));
          startNew();
        }
      })
      .catch(() => setError("La conversation n’a pas pu être chargée."))
      .finally(() => setLoading(false));
  };

  const remove = (id: string) => {
    setConversations((list) => list.filter((c) => c.id !== id));
    if (id === active) startNew();
    deleteConversation(id).catch(() => {});
  };

  /** `withFiles`: the composer's send, which carries the photos and videos added to it. */
  const send = (raw: string, withFiles = false) => {
    const text = raw.trim();
    const ready = withFiles ? files.filter((f) => f.status === "ready" && f.path) : [];
    if ((!text && !ready.length) || pending || (withFiles && uploading)) return;
    setDraft("");
    setError(null);
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
      cards: [],
      openPost: null,
      ...part,
    });
    setMessages((m) => [
      ...m,
      ...ready.map((f, i) => local({ type: f.video ? "video" : "image", media: { url: f.preview, video: f.video } }, i)),
      ...(text ? [local({ body: text }, ready.length)] : []),
    ]);
    const attachments: Attachment[] = ready.map((f) => ({ path: f.path!, mime: f.file.type, size: f.file.size }));
    if (withFiles) setFiles([]);
    const conversationId = active;
    startTransition(async () => {
      try {
        const res = await sendToFauve(text, conversationId, attachments);
        if (res.ok) {
          setActive(res.conversationId);
          setMessages(res.messages);
          setConversations(res.conversations);
        } else {
          setError(res.error);
          if (res.conversationId) setActive(res.conversationId);
        }
      } catch {
        setError("Ton message n’est pas parti. Vérifie ta connexion et réessaie.");
      }
    });
  };

  // « Lancer » on a quote card: the montage starts at once, no round trip through Fauve.
  const launch = (quoteId: string) => {
    if (!active || pending) return;
    setError(null);
    const conversationId = active;
    startTransition(async () => {
      try {
        const res = await launchQuote(quoteId, conversationId);
        if (res.ok) {
          setMessages(res.messages);
          setConversations(res.conversations);
        } else setError(res.error);
      } catch {
        setError("Le montage n’a pas pu démarrer. Vérifie ta connexion et réessaie.");
      }
    });
  };

  // Emoji picker: inserted where the cursor is.
  const [emojiOpen, setEmojiOpen] = useState(false);
  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  // Same emoji again removes it. Shown at once, saved in the background.
  const react = (id: string, emoji: string) => {
    const next = messages.find((m) => m.id === id)?.reactions.me === emoji ? null : emoji;
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, reactions: { ...m.reactions, me: next ?? undefined } } : m)));
    reactToMessage(id, next).catch(() => {});
  };

  const fresh = !active && messages.length === 0;
  const list = (
    <ConversationList conversations={conversations} active={active} onOpen={open} onNew={startNew} onDelete={remove} />
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-line bg-white md:flex">{list}</aside>

      {showList && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-ink/30" onClick={() => setShowList(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-white shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <button type="button" aria-label="Fermer" onClick={() => setShowList(false)} className="flex size-9 items-center justify-center rounded-full hover:bg-soft">
                <XIcon size={18} />
              </button>
            </div>
            {list}
          </div>
        </div>
      )}

      <section
        className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top_right,#efebff_0%,rgba(239,235,255,0)_55%),radial-gradient(ellipse_at_bottom_left,#fff1ec_0%,rgba(255,241,236,0)_50%)]"
        // Drop zone: photos and videos dropped anywhere on the conversation.
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
          addFiles(e.dataTransfer.files);
          inputRef.current?.focus();
        }}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-violet bg-violet-soft/85 text-center">
            <PaperclipIcon size={28} className="text-violet" />
            <p className="text-[17px] font-bold text-violet">Dépose tes photos et vidéos</p>
            <p className="text-[14px] text-violet/80">Fauve en fait un Reel, un carrousel ou un post</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 sm:px-6 sm:pt-5">
          <div className="flex items-center gap-1 md:invisible">
            <button type="button" onClick={() => setShowList(true)} className="h-9 rounded-full px-3 text-[13px] font-bold hover:bg-white">
              Conversations
            </button>
            <button type="button" aria-label="Nouvelle conversation" onClick={startNew} className="flex size-9 items-center justify-center rounded-full hover:bg-white">
              <PenIcon size={18} />
            </button>
          </div>
          <a
            href={whatsappHref}
            aria-label="Continuer sur WhatsApp"
            title="Continuer sur WhatsApp"
            className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
          >
            <WhatsAppIcon size={20} />
          </a>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {fresh ? (
            <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col items-center justify-center gap-6 px-4 py-8 text-center">
              <Mascot size={104} />
              <div className="flex flex-col gap-3">
                <h1 className="text-[34px] font-extrabold tracking-[-0.03em] sm:text-[46px]">
                  Bonjour{firstName ? " " : ""}
                  {firstName && <span className="accent">{firstName}</span>}
                </h1>
                <p className="mx-auto max-w-[560px] text-[16px] text-muted sm:text-[17px]">{summary}</p>
              </div>
              <a
                href={whatsappHref}
                className="inline-flex h-12 items-center gap-2.5 rounded-full border border-line bg-white px-5 text-[15px] font-semibold text-violet shadow-[0_2px_10px_rgba(28,21,48,0.05)] hover:border-lilac"
              >
                <WhatsAppIcon size={18} />
                Continuer sur WhatsApp
              </a>
              <ul className="grid w-full gap-3 pt-2 sm:grid-cols-2">
                {suggestions.map((s) => {
                  const Icon = icons[s.icon];
                  return (
                    <li key={s.label}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => send(s.prompt)}
                        className="flex h-[60px] w-full items-center gap-3.5 rounded-[18px] border border-line bg-white px-5 text-left text-[15px] font-medium shadow-[0_2px_10px_rgba(28,21,48,0.04)] transition-colors hover:border-lilac disabled:opacity-60"
                      >
                        <span className="text-violet">
                          <Icon size={20} />
                        </span>
                        {s.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-[780px] flex-col gap-3 px-4 py-6">
              {loading && <p className="self-center text-sm text-muted">Chargement…</p>}
              {messages.map((m, i) => (
                <Bubble
                  key={m.id}
                  message={m}
                  time={timeFormat.format(new Date(m.at))}
                  timezone={timezone}
                  onReact={react}
                  // Answer buttons only on Fauve's latest message, while it is still the question.
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
          )}
        </div>

        <form
          className="px-4 pt-2 pb-4 sm:px-6 sm:pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft, true);
          }}
        >
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-2">
            {error && (
              <p role="alert" className="self-center rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-danger">
                {error}
              </p>
            )}
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2 px-2" aria-label="Fichiers à envoyer">
                {files.map((f) => (
                  <li key={f.id} className="relative size-16 overflow-hidden rounded-[12px] border border-line bg-soft">
                    {f.video ? (
                      <video src={`${f.preview}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" className="size-full object-cover" />
                    )}
                    {f.video && <PlayIcon size={12} className="absolute bottom-1 left-1 text-white drop-shadow" />}
                    {f.status !== "ready" && (
                      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${f.status === "error" ? "bg-peach/90 text-danger" : "bg-white/70 text-muted"}`}>
                        {f.status === "error" ? "Échec" : "Envoi…"}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Retirer"
                      onClick={() => removeFile(f.id)}
                      className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-ink/70 text-white"
                    >
                      <XIcon size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative flex items-end gap-1 rounded-[30px] border border-line bg-white p-2 pl-2 shadow-[0_8px_30px_rgba(28,21,48,0.08)] focus-within:border-lilac">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                aria-label="Ajouter des photos ou des vidéos"
                title="Photos et vidéos"
                onClick={() => fileRef.current?.click()}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink"
              >
                <PaperclipIcon size={21} />
              </button>
              <button
                type="button"
                aria-label="Ajouter un emoji"
                aria-expanded={emojiOpen}
                onClick={() => setEmojiOpen((o) => !o)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink"
              >
                <SmileIcon size={22} />
              </button>
              {emojiOpen && (
                <>
                  <button type="button" aria-label="Fermer" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setEmojiOpen(false)} />
                  <div
                    role="listbox"
                    aria-label="Emojis"
                    className="absolute bottom-full left-0 z-20 mb-2 grid w-[296px] grid-cols-8 gap-0.5 rounded-[18px] border border-line bg-white p-2 shadow-[0_12px_36px_rgba(28,21,48,0.14)]"
                  >
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        role="option"
                        aria-selected={false}
                        aria-label={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="flex size-9 items-center justify-center rounded-lg text-[20px] hover:bg-soft"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label htmlFor="message-fauve" className="sr-only">
                Message à Fauve
              </label>
              <textarea
                id="message-fauve"
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(draft, true);
                  }
                }}
                placeholder={files.length ? "Dis à Fauve ce que tu veux en faire : un Reel, un carrousel…" : "Demande à Fauve…"}
                className="max-h-[180px] min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] outline-none placeholder:text-muted/70"
              />
              <button
                type="submit"
                aria-label="Envoyer"
                disabled={pending || uploading || (!draft.trim() && !files.some((f) => f.status === "ready"))}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet text-white transition-colors disabled:bg-chip disabled:text-muted"
              >
                <ArrowUpIcon />
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function ConversationList({
  conversations,
  active,
  onOpen,
  onNew,
  onDelete,
}: {
  conversations: ConversationSummary[];
  active: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-3">
        <h2 className="text-[15px] font-bold">Conversations</h2>
        <button
          type="button"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          onClick={onNew}
          className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink"
        >
          <PenIcon size={18} />
        </button>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
        {conversations.length === 0 && <li className="px-2 py-2 text-sm text-muted">Tes conversations avec Fauve s’afficheront ici.</li>}
        {conversations.map((c) => (
          <li key={c.id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              aria-current={c.id === active ? "true" : undefined}
              className={`block w-full truncate rounded-[12px] py-2.5 pr-10 pl-3 text-left text-[14px] ${
                c.id === active ? "bg-violet-soft font-semibold text-ink" : "text-ink/85 hover:bg-soft"
              }`}
            >
              {c.title ?? `Conversation du ${new Date(c.lastAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
            </button>
            <button
              type="button"
              aria-label="Supprimer la conversation"
              title="Supprimer"
              onClick={() => onDelete(c.id)}
              className={`absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-violet hover:bg-white focus-visible:opacity-100 ${
                c.id === active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <TrashIcon size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REACTIONS = ["👍", "❤️", "🔥", "😂", "😮", "🙏"];

function Bubble({
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
