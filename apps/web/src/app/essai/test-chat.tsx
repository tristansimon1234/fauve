"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { statusLabels, type PostStatus } from "@fauve/agent";
import { ArrowUpIcon, CalendarIcon, CheckIcon, FilmIcon, PenIcon } from "@/components/icons";
import { Logo, Orb } from "@/components/orb";
import type { ChatMessage, TestSnapshot, TestState } from "@/lib/test-studio";
import { resetTest, sendTestMessage } from "./actions";

const onboardingLabels: Record<string, string> = {
  studio_name: "Nom du studio",
  rhythm: "Rythme",
  examples: "Exemples de posts",
  connect: "Connexion Instagram",
  done: "Terminé",
};

const kindLabels: Record<string, string> = { reel: "Reel", post: "Post", carousel: "Carrousel", story: "Story" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function TestChat({ testKey, initial }: { testKey: string; initial: TestState }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [snapshot, setSnapshot] = useState<TestSnapshot>(initial.snapshot);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setError(null);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, from: "me", body: text, at: new Date().toISOString() }]);
    startTransition(async () => {
      const res = await sendTestMessage(testKey, text);
      if (res.ok) {
        setMessages(res.state.messages);
        setSnapshot(res.state.snapshot);
      } else {
        setError(res.error);
      }
    });
  }

  function reset() {
    if (!window.confirm("Effacer le studio de test et recommencer l’onboarding ?")) return;
    setError(null);
    startTransition(async () => {
      const res = await resetTest(testKey);
      if (res.ok) {
        setMessages(res.state.messages);
        setSnapshot(res.state.snapshot);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-soft lg:h-dvh lg:flex-row">
      <section className="flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:min-h-0">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size={30} />
            <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-bold text-peach-ink">Mode test</span>
          </div>
          <button type="button" onClick={reset} disabled={pending} className="text-sm font-bold text-violet disabled:opacity-50">
            Recommencer à zéro
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-chat px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-[720px] flex-col gap-2.5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Orb size={64} />
                <p className="max-w-[420px] text-[15px] leading-relaxed text-muted">
                  Tu es une gérante qui écrit à Fauve pour la première fois. Dis bonjour : Fauve va te guider pour
                  configurer ton studio, comme sur WhatsApp.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
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
        </div>

        <form
          className="border-t border-line bg-white px-3 py-3 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="mx-auto flex max-w-[720px] items-end gap-2">
            <label htmlFor="msg" className="sr-only">
              Message à Fauve
            </label>
            <textarea
              id="msg"
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
      </section>

      <Panel snapshot={snapshot} />
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.from === "me";
  return (
    <div
      className={`max-w-[85%] px-3.5 py-2.5 text-[15px] leading-[1.45] whitespace-pre-wrap ${
        mine
          ? "self-end rounded-[16px_16px_4px_16px] bg-violet text-white"
          : "self-start rounded-[16px_16px_16px_4px] border border-line bg-white"
      }`}
    >
      {message.body}
    </div>
  );
}

function Panel({ snapshot }: { snapshot: TestSnapshot }) {
  const { studio, plan, posts, shots } = snapshot;
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-line bg-white p-5 lg:w-[360px] lg:border-t-0 lg:border-l">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold">Ce que Fauve a enregistré</h2>
        <p className="text-[13px] text-muted">Mis à jour après chaque réponse, depuis la base Supabase.</p>
      </div>

      <Card title="Studio">
        <Row label="Nom" value={studio.name ?? "—"} />
        <Row label="Gérante" value={snapshot.manager ?? "—"} />
        <Row label="Onboarding" value={onboardingLabels[studio.onboardingStep] ?? studio.onboardingStep} />
        <Row
          label="Rythme"
          value={plan ? `${plan.postsPerWeek} posts + ${plan.storiesPerWeek} stories / sem.` : "—"}
        />
        <Row label="Plateformes" value={plan?.platforms.join(", ") || "—"} />
        <Row label="Profil de style" value={snapshot.brandVersion ? `version ${snapshot.brandVersion}` : "—"} />
      </Card>

      <Card title="Calendrier" icon={<CalendarIcon size={16} />}>
        {posts.length === 0 ? (
          <Empty>Aucune publication pour l’instant.</Empty>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-t-0 first:pt-0">
              <span className="text-[11px] font-extrabold tracking-[.05em] text-muted uppercase">
                {kindLabels[p.kind] ?? p.kind}
                {p.scheduledAt ? ` · ${dateFormat.format(new Date(p.scheduledAt))}` : ""}
              </span>
              <span className="text-sm font-bold">{p.title}</span>
              <span className="text-xs font-semibold text-violet">
                {statusLabels[p.status as PostStatus]?.label ?? p.status}
              </span>
            </div>
          ))
        )}
      </Card>

      <Card title="À filmer" icon={<FilmIcon size={16} />}>
        {shots.length === 0 ? (
          <Empty>Rien à filmer pour l’instant.</Empty>
        ) : (
          shots.map((s) => (
            <div key={s.id} className="flex gap-2">
              <span className="mt-0.5 text-violet">{s.done ? <CheckIcon size={16} /> : <PenIcon size={16} />}</span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{s.label}</span>
                {s.hint && <span className="text-xs text-muted">{s.hint}</span>}
              </span>
            </div>
          ))
        )}
      </Card>

      <p className="text-xs text-muted">Coût IA de ce studio de test : {snapshot.costEur.toFixed(3)} €</p>
    </aside>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-line p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        {icon && <span className="text-violet">{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
