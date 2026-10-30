"use client";

import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { ChatCard } from "@/lib/chat-cards";
import { quoteProgress, type ChatMessage, type QuoteProgress } from "./chat-actions";

// Keeping the open conversation current without disturbing it, shared by the
// Fauve page and the chat drawer: what a refresh changed (new messages,
// reactions, a montage's step), which messages just arrived (they rise in), and
// the progress of launched montages, polled on its own while they run.

/** A signed link without its token: the same file signed twice compares equal. */
const fileOf = (url: string | null | undefined) => url?.split("?")[0] ?? "";

function cardSignature(card: ChatCard): string {
  if (card.type === "quote") {
    const q = card.quote;
    return `q:${q.id}:${q.state}:${q.stage ?? ""}:${q.effort ?? ""}:${q.failed ? 1 : 0}:${q.charged ?? ""}:${q.balance}`;
  }
  if (card.type === "post") return `p:${card.post.id}:${card.post.status}:${fileOf(card.post.media?.url)}`;
  return `g:${card.posts.map((p) => `${p.id}:${p.status}:${fileOf(p.media?.url)}`).join(",")}`;
}

/** What a refresh can change in a message: reactions, its cards (a montage's step, a new render), its media. */
const signature = (m: ChatMessage) =>
  [m.id, m.reactions.fauve ?? "", m.reactions.me ?? "", fileOf(m.videoUrl), fileOf(m.media?.url), ...m.cards.map(cardSignature)].join("|");

export const chatSignature = (list: ChatMessage[]) => list.map(signature).join("\n");

/**
 * The fresh conversation, keeping every unchanged message as it was, and the
 * media links already loaded in changed ones: no video in the thread reloads
 * (and stops) because the server signed its link again.
 */
export function mergeMessages(before: ChatMessage[], after: ChatMessage[]): ChatMessage[] {
  const old = new Map(before.map((m) => [m.id, m]));
  return after.map((m) => {
    const o = old.get(m.id);
    if (!o) return m;
    if (signature(o) === signature(m)) return o;
    const keep = <T extends { url: string } | null>(a: T, b: T): T => (a && b && fileOf(a.url) === fileOf(b.url) ? a : b);
    const posts = new Map(o.cards.flatMap((c) => (c.type === "post" ? [[c.post.id, c.post] as const] : c.type === "grid" ? c.posts.map((p) => [p.id, p] as const) : [])));
    return {
      ...m,
      videoUrl: o.videoUrl && m.videoUrl && fileOf(o.videoUrl) === fileOf(m.videoUrl) ? o.videoUrl : m.videoUrl,
      media: keep(o.media, m.media),
      cards: m.cards.map((c): ChatCard =>
        c.type === "post"
          ? { ...c, post: { ...c.post, media: keep(posts.get(c.post.id)?.media ?? null, c.post.media) } }
          : c.type === "grid"
            ? { ...c, posts: c.posts.map((p) => ({ ...p, media: keep(posts.get(p.id)?.media ?? null, p.media) })) }
            : c,
      ),
    };
  });
}

/**
 * Messages to animate in: what a send, a launch or a refresh added. The
 * manager's saved messages replacing her optimistic ones do not rise a second
 * time, and a conversation that loads whole never animates.
 */
export function arrivals(before: ChatMessage[], after: ChatMessage[]): Set<string> {
  const known = new Set(before.map((m) => m.id));
  const optimistic = before.some((m) => m.id.startsWith("local-"));
  return new Set(after.filter((m) => !known.has(m.id) && !(optimistic && m.from === "me")).map((m) => m.id));
}

/** The quote cards of a conversation patched with fresh progress; the same list when nothing moved. */
function patchQuotes(list: ChatMessage[], rows: QuoteProgress[]): ChatMessage[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const moved = (c: ChatCard) => {
    if (c.type !== "quote") return false;
    const r = byId.get(c.quote.id);
    return Boolean(
      r && (r.state !== c.quote.state || r.stage !== c.quote.stage || r.failed !== c.quote.failed || r.charged !== c.quote.charged || r.effort !== c.quote.effort || r.effect !== c.quote.effect),
    );
  };
  if (!list.some((m) => m.cards.some(moved))) return list;
  return list.map((m) =>
    m.cards.some(moved) ? { ...m, cards: m.cards.map((c): ChatCard => (c.type === "quote" && moved(c) ? { ...c, quote: { ...c.quote, ...byId.get(c.quote.id)! } } : c)) } : m,
  );
}

const PROGRESS_MS = 4000;
/** A montage launched longer ago than this is not polled any more (it failed without a word; its card says it is late). */
const STALE_MS = 3 * 3600_000;

/**
 * While a quote card shows a launched montage, reads where it is every few
 * seconds (only that, not the whole conversation) and moves the card along.
 * When it leaves « launched » (delivered, or open again after a failure),
 * `onSettled` reloads the conversation: the delivery message comes in.
 */
export function useQuoteProgress(messages: ChatMessage[], setMessages: Dispatch<SetStateAction<ChatMessage[]>>, onSettled: () => void) {
  // Each launched quote as « id@launch time », so the list only changes when a montage starts or ends.
  const launched = [
    ...new Set(messages.flatMap((m) => m.cards.flatMap((c) => (c.type === "quote" && c.quote.state === "launched" ? [`${c.quote.id}@${c.quote.startedAt ?? ""}`] : [])))),
  ]
    .sort()
    .join(",");
  const settled = useRef(onSettled);
  useEffect(() => {
    settled.current = onSettled;
  });
  useEffect(() => {
    if (!launched) return;
    let alive = true;
    const timer = window.setInterval(() => {
      const ids = launched.split(",").flatMap((entry) => {
        const [id, at] = entry.split("@");
        return id && (!at || Date.now() - Date.parse(at) < STALE_MS) ? [id] : [];
      });
      if (document.visibilityState !== "visible" || !ids.length) return;
      quoteProgress(ids)
        .then((rows) => {
          if (!alive || !rows.length) return;
          setMessages((list) => patchQuotes(list, rows));
          if (rows.some((r) => r.state !== "launched")) settled.current();
        })
        .catch(() => {});
    }, PROGRESS_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [launched, setMessages]);
}

/** The first launched montage of a conversation, if any (the reminder above the thread). */
export function runningQuote(messages: ChatMessage[]) {
  for (const m of messages) for (const c of m.cards) if (c.type === "quote" && c.quote.state === "launched") return c.quote;
  return null;
}

/**
 * Refreshes that overlap one of her turns are dropped. Read just before her message was saved, a
 * fresh conversation replaced the list and took away the message she had just sent (shown at once,
 * saved during the turn) until Edith answered (Tristan: « mon message disparaît quand Edith
 * réfléchit »); read during the turn, it could take away Edith's answer once it had landed.
 */
export function useTurnGuard() {
  const turn = useRef({ seq: 0, busy: false });
  return useMemo(
    () => ({
      begin: () => {
        turn.current = { seq: turn.current.seq + 1, busy: true };
      },
      end: () => {
        turn.current = { seq: turn.current.seq + 1, busy: false };
      },
      /** Taken when a refresh starts. */
      stamp: () => turn.current.seq,
      /** A refresh that started at `stamp` is stale: a turn began or ended since, or one is running. */
      stale: (stamp: number) => turn.current.busy || turn.current.seq !== stamp,
    }),
    [],
  );
}
