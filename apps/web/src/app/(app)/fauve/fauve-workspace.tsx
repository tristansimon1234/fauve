"use client";

import type { Effort } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type RefObject } from "react";
import {
  ArrowUpIcon,
  BulbIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  PlusIcon,
  FilmIcon,
  PaperclipIcon,
  PenIcon,
  ReplyIcon,
  SmileIcon,
  TrashIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { NewPostSheet } from "@/components/new-post-sheet";
import { Orb } from "@/components/orb";
import type { CardQuote } from "@/lib/chat-cards";
import { Bubble } from "./chat-bubble";
import { montageStep } from "./chat-cards";
import { arrivals, chatSignature, mergeMessages, runningQuote, useQuoteProgress } from "./chat-sync";
import { isFunny, upsetLevel } from "@fauve/agent";
import { FileStrip, useChatUploads } from "./chat-uploads";
import type { OnboardingView } from "./onboarding-actions";
import { OnboardingCard, OnboardingStepper } from "@/components/onboarding/onboarding-card";
import { applyLive, liveTurn, type LiveState } from "./live-turn";
import { BrigitteLive, type BrigitteCue } from "./brigitte-avatar";
import { LiveTyping } from "./live-typing";
import {
  deleteConversation,
  launchQuote,
  listConversations,
  loadConversation,
  reactToMessage,
  type Attachment,
  type ChatMessage,
  type ConversationSummary,
} from "./chat-actions";

/** A photo or video added to the composer: uploaded at once, sent with the next message. */

export type Suggestion = { icon: keyof typeof icons; label: string; hint?: string } & ({ prompt: string; action?: undefined } | { action: "new-post"; prompt?: undefined });

const icons = {
  film: FilmIcon,
  calendar: CalendarIcon,
  check: CheckIcon,
  bulb: BulbIcon,
  chart: ChartIcon,
  reply: ReplyIcon,
  pen: PenIcon,
  plus: PlusIcon,
};

const POLL_MS = 8000;

const EMOJIS = [
  "😊", "😂", "🥰", "😍", "🤩", "😎", "🙏", "👍",
  "👏", "🙌", "💪", "🔥", "✨", "💜", "❤️", "🧡",
  "🌿", "🌸", "☀️", "🌙", "🧘‍♀️", "🤸‍♀️", "💃", "🎉",
  "📅", "📸", "🎬", "✅", "👀", "🤔", "😮", "😅",
];
const LIST_POLL_MS = 30000;
/** A delivered montage opens its page after this, once its card has said « Ta vidéo est prête ». */
const OPEN_DELAY_MS = 700;

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
  onboarding = null,
}: {
  /** Getting started, while it is not done: the current step on the home, and its card. */
  onboarding?: OnboardingView | null;
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
  // « Créer une publication »: the same steps as in the calendar.
  const [creating, setCreating] = useState(false);
  // While Fauve answers: the line of what she is doing, then her words as she writes them.
  const [live, setLive] = useState<LiveState | null>(null);
  // Brigitte's instant reaction to the message being answered (Jev), until the next one.
  const [turnMood, setTurnMood] = useState<BrigitteCue | null>(null);
  // Messages that just arrived (they rise in); a conversation that loads whole does not animate.
  const [arrived, setArrived] = useState<Set<string>>(() => new Set());
  // The quote launched from its card: no « Fauve écrit… » meanwhile (nobody is writing), and its progress is scrolled to.
  const [launching, setLaunching] = useState<string | null>(null);
  // The post about to open (a montage just delivered): its card says so.
  const [opening, setOpening] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });

  // Photos and videos: uploaded to Storage as soon as they are added, sent with the message.
  const uploads = useChatUploads(studioId, setError);
  const { files, addFiles, removeFile, uploading } = uploads;

  // Keep the open conversation in the URL, so a reload lands on it.
  useEffect(() => {
    window.history.replaceState(null, "", active ? `?c=${active}` : window.location.pathname);
  }, [active]);

  // Scroll: at once to the end when a conversation opens, smoothly (CSS, off under reduced motion)
  // when something arrives, and only if she is near the end or just wrote. After a launch, to the
  // card's progress instead of the end.
  const jump = useRef(true);
  const follow = useRef(true);
  const focusQuote = useRef<string | null>(null);
  const lastId = messages.at(-1)?.id;
  const mineLast = messages.at(-1)?.from === "me";
  const typing = pending && !launching;
  useEffect(() => {
    const quote = focusQuote.current;
    focusQuote.current = null;
    const progress = quote ? scrollerRef.current?.querySelector<HTMLElement>(`[data-quote="${quote}"] [data-progress]`) : null;
    if (progress) progress.scrollIntoView({ block: "nearest", behavior: "auto" });
    else if (jump.current || follow.current || mineLast || typing) endRef.current?.scrollIntoView({ block: "end", behavior: jump.current ? "instant" : "auto" });
    jump.current = false;
  }, [lastId, mineLast, typing]);

  // Montage videos and WhatsApp messages arrive on their own: refresh while visible, keeping
  // what did not change (no video reloads). A montage just delivered opens its publication page,
  // once its card shows it is ready, and only if the composer is empty (nothing she is writing is lost).
  const router = useRouter();
  const messagesRef = useRef(messages);
  const activeRef = useRef(active);
  const composing = useRef(false);
  useEffect(() => {
    messagesRef.current = messages;
    activeRef.current = active;
    composing.current = Boolean(draft.trim() || files.length);
  }, [messages, active, draft, files.length]);
  const openWhenReady = useRef<string | null>(null);
  const openTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(openTimer.current), []);
  const refresh = useCallback(
    (id: string) => {
      loadConversation(id)
        .then((fresh) => {
          if (!fresh || activeRef.current !== id) return;
          const current = messagesRef.current;
          const known = new Set(current.map((m) => m.id));
          const delivered = fresh.find((m) => !known.has(m.id) && m.openPost)?.openPost;
          if (delivered) openWhenReady.current = delivered;
          if (chatSignature(fresh) !== chatSignature(current)) {
            setArrived(arrivals(current, fresh));
            setMessages(mergeMessages(current, fresh));
          }
          const target = openWhenReady.current;
          const stillRunning = fresh.some((m) =>
            m.cards.some((c) => c.type === "quote" && c.quote.postId === target && c.quote.state === "launched" && c.quote.stage !== "delivered"),
          );
          if (!target || stillRunning) return;
          openWhenReady.current = null;
          if (composing.current) return;
          setOpening(target);
          openTimer.current = window.setTimeout(() => router.push(`/publications/${target}`), OPEN_DELAY_MS);
        })
        .catch(() => {});
    },
    [router],
  );
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || pending) return;
      refresh(active);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, pending, refresh]);
  // A launched montage's card moves every few seconds; when it is done, the conversation reloads at once.
  useQuoteProgress(messages, setMessages, () => {
    if (activeRef.current) refresh(activeRef.current);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") listConversations().then(setConversations).catch(() => {});
    }, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const startNew = useCallback(() => {
    setActive(null);
    setMessages([]);
    setArrived(new Set());
    setError(null);
    setShowList(false);
    inputRef.current?.focus();
  }, []);

  const open = (id: string) => {
    setShowList(false);
    if (id === active) return;
    setActive(id);
    setMessages([]);
    setArrived(new Set());
    setError(null);
    setLoading(true);
    loadConversation(id)
      .then((loaded) => {
        if (loaded) {
          jump.current = true;
          setMessages(loaded);
        } else {
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
    setLaunching(null);
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
      ...ready.map((f, i) => local({ type: f.video ? "video" : "image", media: { url: f.preview, video: f.video } }, i)),
      ...(text ? [local({ body: text }, ready.length)] : []),
    ];
    setArrived(new Set(locals.map((m) => m.id)));
    setMessages((m) => [...m, ...locals]);
    const attachments: Attachment[] = ready.map((f) => ({ path: f.path!, mime: f.file.type, size: f.file.size }));
    if (withFiles) uploads.clear();
    const conversationId = active;
    startTransition(async () => {
      try {
        setLive({ status: null, text: "", step: -1 });
        setTurnMood(null);
        const res = await liveTurn({ text, conversationId, attachments }, (event) => {
          if (event.type === "mood") {
            if (event.mood !== "neutral") setTurnMood({ id: `instant-${Date.now()}`, mood: event.mood, fresh: true });
            // Her emoji shows on the message at once, before her answer.
            const emoji = event.emoji;
            if (emoji) {
              setMessages((list) => {
                const i = list.findLastIndex((m) => m.from === "me");
                return i < 0 ? list : list.map((m, j) => (j === i ? { ...m, reactions: { ...m.reactions, fauve: emoji } } : m));
              });
            }
            return;
          }
          setLive((state) => applyLive(state ?? { status: null, text: "", step: -1 }, event));
        });
        if (res.ok) {
          setActive(res.conversationId);
          setArrived(arrivals(messagesRef.current, res.messages));
          setMessages(mergeMessages(messagesRef.current, res.messages));
          setConversations(res.conversations);
          // Getting started: Fauve may have moved to the next step.
          if (onboarding) router.refresh();
        } else {
          setError(res.error);
          if (res.conversationId) setActive(res.conversationId);
        }
      } catch {
        setError("Ton message n’est pas parti. Vérifie ta connexion et réessaie.");
      } finally {
        setLive(null);
      }
    });
  };

  // « Lancer » on a quote card: the montage starts at once, no round trip through Fauve.
  // The card shows its own progress and error; the answer is the error, or null.
  const launch = (quoteId: string, effort?: Effort) =>
    new Promise<string | null>((resolve) => {
      if (!active || pending) return resolve("Attends la fin du message en cours, puis relance.");
      setError(null);
      setLaunching(quoteId);
      const conversationId = active;
      startTransition(async () => {
        try {
          const res = await launchQuote(quoteId, conversationId, effort);
          if (res.ok) {
            focusQuote.current = quoteId;
            setArrived(arrivals(messagesRef.current, res.messages));
            setMessages(mergeMessages(messagesRef.current, res.messages));
            setConversations(res.conversations);
            resolve(null);
          } else resolve(res.error);
        } catch {
          resolve("Le montage n’a pas pu démarrer. Vérifie ta connexion et réessaie.");
        }
      });
    });
  // From a card, whichever message it is on (an expired quote, a late montage).
  const ask = (text: string) => {
    if (!pending) send(text);
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
  const running = runningQuote(messages);
  const list = (
    <ConversationList conversations={conversations} active={active} onOpen={open} onNew={startNew} onDelete={remove} />
  );

  const lastFauve = messages.findLastIndex((m) => m.from === "fauve");
  // What Brigitte reacts to in the header: her latest message, and the manager's words before it.
  const latest = lastFauve >= 0 ? messages[lastFauve] : null;
  const asked = messages.slice(0, lastFauve).findLast((x) => x.from === "me")?.body;
  // While she writes: her instant reaction to the message (Jev); then her face as her answer arrives.
  const cue: BrigitteCue | null = typing
    ? turnMood
    : latest
      ? {
          id: latest.id,
          mood: turnMood?.mood ?? upsetLevel(asked) ?? (isFunny(latest.body) || isFunny(asked) ? "laugh" : "happy"),
          fresh: arrived.has(latest.id),
        }
      : null;
  // Getting started: the current step's card always sits under Brigitte's latest
  // message, even when she forgot to attach it; not when she offered answer
  // buttons or asked for files instead (the first post's flow in the chat), nor
  // Instagram (she offers it herself once the publication is ready, not during the montage).
  const last = messages.at(-1);
  const stepUnder =
    onboarding && onboarding.step !== "done" && onboarding.step !== "connect" && last?.from === "fauve" && !last.options.length && !last.upload && !last.pickMedia && last.stepCard !== onboarding.step
      ? onboarding.step
      : null;
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-line bg-white md:flex">{list}</aside>

      {showList && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
          <button type="button" aria-label="Fermer" className="fauve-fade absolute inset-0 bg-ink/30" onClick={() => setShowList(false)} />
          <div className="fauve-sheet absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-white shadow-xl [--fauve-from:-100%]">
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
          <div className="fauve-fade pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-violet bg-violet-soft/85 text-center">
            <PaperclipIcon size={28} className="text-violet" />
            <p className="text-[17px] font-bold text-violet">Dépose tes photos et vidéos</p>
            <p className="text-[14px] text-violet/80">Brigitte en fait un Reel, un carrousel ou un post</p>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 pt-3 sm:px-6 sm:pt-4">
          {/* Brigitte herself, top left of the conversation: she thinks, laughs, frowns as it goes (hidden while the welcome shows her big). */}
          {!fresh && (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="hidden sm:block">
                <BrigitteLive typing={typing} cue={cue} size={60} />
              </span>
              <span className="sm:hidden">
                <BrigitteLive typing={typing} cue={cue} size={44} />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[15px] font-bold">Brigitte</span>
                <span key={typing ? (live?.status ?? "writing") : "online"} className={`fauve-fade truncate text-[12px] ${typing ? "text-violet" : "text-muted"}`}>
                  {typing ? (live?.status ?? "écrit…") : "ta community manager"}
                </span>
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setShowList(true)} className="h-9 rounded-full px-3 text-[13px] font-bold hover:bg-white md:hidden">
              Conversations
            </button>
            <button type="button" aria-label="Nouvelle conversation" onClick={startNew} className="flex size-9 items-center justify-center rounded-full hover:bg-white md:hidden">
              <PenIcon size={18} />
            </button>
            <a
              href={whatsappHref}
              aria-label="Continuer sur WhatsApp"
              title="Continuer sur WhatsApp"
              className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
            >
              <WhatsAppIcon size={20} />
            </a>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="fauve-scroll min-h-0 flex-1 overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
          }}
        >
          {fresh && onboarding && onboarding.step !== "done" ? (
            <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col items-center justify-center gap-6 px-4 py-8 text-center">
              <Mascot size={88} />
              <div className="flex flex-col gap-2.5">
                <h1 className="text-[32px] font-extrabold tracking-[-0.03em] sm:text-[42px]">
                  Bienvenue{firstName ? " " : ""}
                  {firstName && <span className="accent">{firstName}</span>}
                </h1>
                <p className="mx-auto max-w-[520px] text-[15px] text-muted sm:text-[16px]">
                  On prépare ton compte ensemble, en cinq étapes. Tu peux aussi me répondre en bas, ou sur WhatsApp.
                </p>
              </div>
              <OnboardingStepper step={onboarding.step} />
              <OnboardingCard key={onboarding.step} step={onboarding.step} timezone={timezone} initial={onboarding} onSend={(text) => send(text)} />
            </div>
          ) : fresh ? (
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
              <ul className="grid w-full gap-3 pt-2 sm:grid-cols-3">
                {suggestions.map((s) => {
                  const Icon = icons[s.icon];
                  return (
                    <li key={s.label}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => (s.action === "new-post" ? setCreating(true) : send(s.prompt))}
                        className="fauve-press flex h-full w-full items-center gap-3.5 rounded-[18px] border border-line bg-white px-5 py-4 text-left shadow-[0_2px_10px_rgba(28,21,48,0.04)] transition-colors hover:border-lilac disabled:opacity-60 sm:flex-col sm:items-start sm:gap-3"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
                          <Icon size={20} />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[15px] font-bold">{s.label}</span>
                          {s.hint && <span className="text-[13px] text-muted">{s.hint}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {creating && <NewPostSheet timezone={timezone} onClose={() => setCreating(false)} />}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-[780px] flex-col gap-3 px-4 py-6">
              {onboarding && onboarding.step !== "done" && (
                <div className="sticky top-0 z-10 -mx-1 rounded-[16px] bg-white/90 px-3 py-2.5 backdrop-blur">
                  <OnboardingStepper step={onboarding.step} />
                </div>
              )}
              {running && <MontageReminder quote={running} scroller={scrollerRef} />}
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
                  onFiles={i === messages.length - 1 ? addFiles : undefined}
                  onAsk={ask}
                  onLaunch={launch}
                  opening={opening}
                  busy={pending}
                  enter={arrived.has(m.id)}
                />
              ))}
              {typing && <LiveTyping live={live} />}
              {/* Getting started: the current step's card always sits under Brigitte's latest message, even when she forgot to attach it. */}
              {!typing && stepUnder && <OnboardingCard key={`under-${stepUnder}`} step={stepUnder} timezone={timezone} initial={onboarding} onSend={(text) => send(text)} className="fauve-enter" />}
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
              <p role="alert" className="fauve-enter self-center rounded-xl bg-peach px-3 py-2 text-sm font-semibold text-danger">
                {error}
              </p>
            )}
            <FileStrip files={files} onRemove={removeFile} />
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
                    className="fauve-pop absolute bottom-full left-0 z-20 mb-2 grid w-[296px] grid-cols-8 gap-0.5 rounded-[18px] border border-line bg-white p-2 shadow-[0_12px_36px_rgba(28,21,48,0.14)] [--fauve-origin:bottom_left]"
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
                Message à Brigitte
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
                placeholder={files.length ? "Dis à Brigitte ce que tu veux en faire : un Reel, un carrousel…" : "Demande à Brigitte, ou glisse tes photos et vidéos ici…"}
                className="max-h-[180px] min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] outline-none placeholder:text-muted/70"
              />
              <button
                type="submit"
                aria-label="Envoyer"
                disabled={pending || uploading || (!draft.trim() && !files.some((f) => f.status === "ready"))}
                className="fauve-press flex size-11 shrink-0 items-center justify-center rounded-full bg-violet text-white hover:bg-violet-hover disabled:bg-chip disabled:text-muted"
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

/**
 * Where the running montage is, pinned above the thread while its card is out of
 * sight (a long conversation, a phone); a tap scrolls back to the card.
 */
function MontageReminder({ quote, scroller }: { quote: CardQuote; scroller: RefObject<HTMLDivElement | null> }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const card = scroller.current?.querySelector(`[data-quote="${quote.id}"] [data-progress]`);
    if (!card) return;
    const observer = new IntersectionObserver(([entry]) => setAway(!entry!.isIntersecting), { root: scroller.current });
    observer.observe(card);
    return () => observer.disconnect();
  }, [quote.id, scroller]);
  return (
    // No height (and no gap): the thread does not move when it appears.
    <div className="sticky top-1 z-10 -mb-3 flex h-0 justify-center">
      {away && (
        <button
          type="button"
          onClick={() => scroller.current?.querySelector(`[data-quote="${quote.id}"] [data-progress]`)?.scrollIntoView({ block: "center", behavior: "auto" })}
          className="fauve-enter fauve-press flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-white/95 px-3.5 text-[13px] font-semibold shadow-[0_4px_14px_rgba(28,21,48,0.08)] backdrop-blur [--fauve-y:-6px]"
        >
          <Orb size={16} />
          {montageStep(quote)}
        </button>
      )}
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
        {conversations.length === 0 && <li className="px-2 py-2 text-sm text-muted">Tes conversations avec Brigitte s’afficheront ici.</li>}
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
