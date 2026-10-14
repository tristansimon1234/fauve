"use client";

import { MAX_FACT_CHARS } from "@fauve/agent";
import { useState, useTransition } from "react";
import { PlusIcon, XIcon } from "@/components/icons";
import { editMemory } from "./actions";

// « Ce que Fauve sait de ton commerce »: the facts Fauve keeps across
// conversations (studios.memory). The manager reads them, removes a wrong one,
// or adds one herself.

export function MemoryList({ initial }: { initial: string[] }) {
  const [facts, setFacts] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (change: { add?: string; remove?: string }, optimistic: string[]) =>
    start(async () => {
      const before = facts;
      setFacts(optimistic);
      setError(null);
      const res = await editMemory(change).catch(() => ({ ok: false as const, error: "Ce n’est pas enregistré. Réessaie." }));
      if (res.ok) setFacts(res.facts);
      else {
        setFacts(before);
        setError(res.error);
      }
    });

  const add = () => {
    const fact = draft.trim();
    if (fact.length < 3) return;
    setDraft("");
    run({ add: fact }, [...facts, fact]);
  };

  return (
    <div className="flex flex-col gap-3">
      {facts.length ? (
        <ul className="flex flex-col gap-1.5">
          {facts.map((fact) => (
            <li key={fact} className="flex items-start gap-2 rounded-[12px] bg-soft px-3 py-2">
              <span className="min-w-0 flex-1 text-[14px] leading-snug">{fact}</span>
              <button
                type="button"
                onClick={() => run({ remove: fact }, facts.filter((f) => f !== fact))}
                aria-label={`Oublier : ${fact}`}
                className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-danger"
              >
                <XIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Rien pour l’instant : Simone note ce que tu lui dis sur ton commerce et ce qu’elle lit sur ton site.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_FACT_CHARS}
          placeholder="Ex. Cours de Pilates Reformer, 12 personnes max"
          aria-label="Ajouter une info"
          className="h-10 min-w-0 flex-1 rounded-[12px] border border-line bg-white px-3 text-[14px] outline-none focus:border-violet"
        />
        <button type="submit" disabled={pending || draft.trim().length < 3} className="btn btn-secondary h-10 px-3.5 text-[14px] disabled:opacity-40">
          <PlusIcon size={16} />
          Ajouter
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
