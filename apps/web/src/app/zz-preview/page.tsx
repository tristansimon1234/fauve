"use client";

// TEMPORARY visual check (deleted after the UX pass).
import type { Effort } from "@fauve/agent";
import { useState } from "react";
import { Bubble } from "@/app/(app)/fauve/chat-bubble";
import type { ChatMessage } from "@/app/(app)/fauve/chat-actions";
import { EffortSetting } from "@/app/(app)/reglages/effort-setting";
import type { CardQuote } from "@/lib/chat-cards";

const NOW = Date.now();
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

const plan = {
  duration: 12,
  style: "doux" as const,
  scenes: [
    { kind: "clip" as const, what: "Accroche : la prof ajuste le reformer, texte « Ton dos te dira merci »" },
    { kind: "clip" as const, what: "Plan large du cours, élèves en planche" },
    { kind: "animation" as const, what: "Titre animé « Cours du jeudi 19 h »" },
    { kind: "clip" as const, what: "Gros plan mains sur la barre" },
    { kind: "end" as const, what: "Logo et « Réserve sur le lien en bio »" },
  ],
};
const lines = {
  rapide: [
    { label: "Montage", credits: 2 },
    { label: "3 clips analysés", credits: 3 },
    { label: "Rendu vidéo", credits: 1 },
  ],
  soigne: [
    { label: "Montage", credits: 2 },
    { label: "3 clips analysés", credits: 3 },
    { label: "Rendu vidéo", credits: 1 },
    { label: "Fauve regarde la vidéo", credits: 1 },
  ],
  max: [
    { label: "Montage", credits: 2 },
    { label: "3 clips analysés", credits: 3 },
    { label: "Rendu vidéo", credits: 1 },
    { label: "2e version à comparer", credits: 3 },
    { label: "Fauve regarde et choisit", credits: 1 },
  ],
};
const efforts = {
  rapide: { base: 6, max: 9, lines: lines.rapide },
  soigne: { base: 7, max: 13, lines: lines.soigne },
  max: { base: 10, max: 19, lines: lines.max },
};

let count = 0;
function quote(over: Partial<CardQuote>): CardQuote {
  const effort = over.effort === undefined ? "soigne" : over.effort;
  const p = effort ? efforts[effort] : efforts.rapide;
  return {
    id: `q-${++count}`,
    title: "Cours du jeudi soir",
    kind: "montage",
    postId: "00000000-0000-4000-8000-000000000001",
    lines: p.lines,
    base: p.base,
    max: p.max,
    state: "open",
    balance: 112,
    plan,
    effort,
    efforts,
    stage: null,
    stageAt: null,
    startedAt: null,
    failed: false,
    charged: null,
    ...over,
  };
}

function message(q: CardQuote, body = "Voici le plan et le prix. Tu peux choisir le niveau de soin avant de lancer.", id = q.id): ChatMessage {
  return {
    id: `m-${id}`,
    from: "fauve",
    channel: "web",
    type: "text",
    body,
    at: ago(2),
    videoUrl: null,
    media: null,
    reactions: {},
    options: [],
    cards: [{ type: "quote", quote: q }],
    openPost: null,
  };
}

const STAGES: CardQuote["stage"][] = [null, "design", "alternative", "render", "review", "fix", "render", "review", "delivered"];

/** One live card: launch it, then walk the chain. */
function Live({ effort }: { effort: Effort }) {
  const [q, setQ] = useState(() => quote({ effort, id: `live-${effort}` }));
  const [i, setI] = useState(0);
  const [enter, setEnter] = useState(false);
  const onLaunch = async (_: string, e?: Effort) => {
    await new Promise((r) => setTimeout(r, 1200));
    if (q.failed) return "Solde de crédits insuffisant pour ce devis.";
    const level = e ?? q.effort;
    setQ((x) => ({ ...x, state: "launched", effort: level, startedAt: ago(0), ...(level ? efforts[level] : {}) }));
    return null;
  };
  const step = () => {
    const next = Math.min(i + 1, STAGES.length - 1);
    setI(next);
    const stage = STAGES[next]!;
    setQ((x) => (stage === "delivered" ? { ...x, stage, state: "delivered", charged: 11, balance: 101 } : { ...x, stage }));
  };
  return (
    <div className="flex flex-col gap-2" data-live={effort}>
      <div className="flex gap-2">
        <button type="button" className="rounded-full border border-line px-3 py-1 text-xs" data-next onClick={step}>
          Étape suivante ({String(STAGES[i])})
        </button>
        <button type="button" className="rounded-full border border-line px-3 py-1 text-xs" onClick={() => setEnter((x) => !x)}>
          enter
        </button>
        <button type="button" className="rounded-full border border-line px-3 py-1 text-xs" data-fail onClick={() => setQ((x) => ({ ...x, failed: true }))}>
          échec
        </button>
      </div>
      <Bubble key={String(enter)} message={message(q)} time="18:42" timezone="Europe/Paris" onReact={() => {}} onLaunch={onLaunch} onChoose={() => {}} onAsk={() => {}} busy={false} enter={enter} />
    </div>
  );
}

const statics: { label: string; q: CardQuote }[] = [
  { label: "open, 2 levels (no Max)", q: quote({ efforts: { rapide: efforts.rapide, soigne: efforts.soigne } }) },
  { label: "open, failed", q: quote({ effort: "rapide", lines: lines.rapide, base: 6, max: 9, failed: true, stageAt: ago(3) }) },
  { label: "launched design (Soigné)", q: quote({ state: "launched", stage: "design", startedAt: ago(1) }) },
  { label: "launched alternative (Max)", q: quote({ state: "launched", effort: "max", ...efforts.max, stage: "alternative", startedAt: ago(4) }) },
  { label: "launched render (Rapide)", q: quote({ state: "launched", effort: "rapide", ...efforts.rapide, stage: "render", startedAt: ago(2) }) },
  { label: "launched review (Soigné)", q: quote({ state: "launched", stage: "review", startedAt: ago(6) }) },
  { label: "launched fix (Max)", q: quote({ state: "launched", effort: "max", ...efforts.max, stage: "fix", startedAt: ago(11) }) },
  { label: "launched late (Soigné)", q: quote({ state: "launched", stage: "review", startedAt: ago(17) }) },
  { label: "launched correction", q: quote({ state: "launched", kind: "correction", plan: null, stage: "design", startedAt: ago(0), title: "Correction : texte plus gros" }) },
  { label: "launched variant", q: quote({ state: "launched", kind: "variant", plan: null, effort: null, efforts: {}, stage: "render", startedAt: ago(1), title: "Variante chic" }) },
  { label: "delivered", q: quote({ state: "delivered", stage: "delivered", charged: 11, balance: 101, startedAt: ago(9) }) },
  { label: "expired", q: quote({ state: "expired" }) },
];

export default function Preview() {
  const [typing, setTyping] = useState(true);
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,#efebff_0%,rgba(239,235,255,0)_55%)] py-6">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-8 px-4">
        <section id="reglages" className="card flex flex-col gap-3 bg-white p-5">
          <h2 className="text-lg font-bold">Soin des montages</h2>
          <p className="text-sm leading-normal">
            Le niveau que Fauve utilise par défaut pour tes Reels. Pour un Reel en particulier, choisis-en un autre sur le devis, ou dis-le-lui.
          </p>
          <EffortSetting initial="soigne" />
        </section>
        <section id="live" className="flex flex-col gap-6">
          <Live effort="soigne" />
          <Live effort="max" />
        </section>
        {statics.map(({ label, q }) => (
          <section key={label} data-case={label} className="flex flex-col gap-2">
            <span className="text-xs font-bold text-muted">{label}</span>
            <Bubble message={message(q)} time="18:42" timezone="Europe/Paris" onReact={() => {}} onLaunch={async () => null} onAsk={() => {}} busy={false} />
          </section>
        ))}
        <section id="typing" className="flex flex-col gap-3">
          <button type="button" className="self-start text-xs" onClick={() => setTyping((t) => !t)}>
            toggle
          </button>
          {typing && (
            <div role="status" className="fauve-enter flex items-center gap-2 self-start rounded-[18px_18px_18px_6px] border border-line bg-white px-4 py-3 text-sm text-muted [--fauve-delay:120ms]">
              <span className="fauve-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Fauve écrit…
            </div>
          )}
        </section>
      </div>
      {/* The drawer's width: the card stacks. */}
      <div id="drawer" className="mx-auto mt-10 flex w-[460px] max-w-full flex-col gap-4 border-x border-line bg-white px-4 py-5">
        <Bubble message={message(quote({}), "Dans le tiroir", "drawer-open")} time="18:42" timezone="Europe/Paris" onReact={() => {}} onLaunch={async () => null} onAsk={() => {}} busy={false} />
        <Bubble
          message={message(quote({ state: "launched", stage: "render", startedAt: ago(3) }), "Lancé", "drawer-launched")}
          time="18:42"
          timezone="Europe/Paris"
          onReact={() => {}}
          onLaunch={async () => null}
          onAsk={() => {}}
          busy={false}
        />
      </div>
    </main>
  );
}
