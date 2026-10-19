"use client";

import { MAX_BRIEF_ANSWER, type BriefAnswer, type BriefQuestion } from "@fauve/agent";
import { useId } from "react";

// Simone's questions before she makes something (packages/agent/src/brief.ts): each with
// its answers to tap, or her own words (« Autre »). In the chat's card and on the Créer screen.

/** One question's answer: a tapped answer, or her own words (null: not writing). */
export type BriefPick = { pick: string | null; own: string | null };

export const emptyPicks = (questions: BriefQuestion[]): BriefPick[] => questions.map(() => ({ pick: null, own: null }));

/** Her answers as Simone reads them: her own words first, else the tapped answer, else empty (Simone chooses). */
export function briefAnswers(questions: BriefQuestion[], picks: BriefPick[]): BriefAnswer[] {
  return questions.map((q, i) => ({ question: q.question, answer: picks[i]?.own?.trim() || picks[i]?.pick || "" }));
}

export function BriefFields({ questions, picks, onChange }: { questions: BriefQuestion[]; picks: BriefPick[]; onChange: (picks: BriefPick[]) => void }) {
  const id = useId();
  const set = (i: number, next: BriefPick) => onChange(questions.map((_, j) => (j === i ? next : (picks[j] ?? { pick: null, own: null }))));
  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, i) => {
        const at = picks[i] ?? { pick: null, own: null };
        const writing = at.own !== null;
        return (
          <div key={`${i}-${q.question}`} className="flex flex-col gap-2">
            <span id={`${id}-${i}`} className="text-[15px] leading-snug font-extrabold">
              {q.question}
            </span>
            <div role="radiogroup" aria-labelledby={`${id}-${i}`} className="flex flex-wrap gap-1.5">
              {q.answers.map((a) => {
                const on = !writing && at.pick === a;
                return (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set(i, { pick: on ? null : a, own: null })}
                    className={`fauve-press min-h-9 rounded-full border-[1.5px] px-3.5 py-1.5 text-left text-[14px] leading-tight font-semibold transition-colors ${
                      on ? "border-violet bg-violet text-white" : "border-line bg-white text-ink hover:border-violet/40"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={writing}
                onClick={() => set(i, { pick: null, own: writing ? null : "" })}
                className={`fauve-press min-h-9 rounded-full border-[1.5px] border-dashed px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  writing ? "border-violet bg-violet-soft text-violet" : "border-line bg-white text-muted hover:border-violet/40"
                }`}
              >
                Autre…
              </button>
            </div>
            {writing && (
              <input
                type="text"
                autoFocus
                value={at.own ?? ""}
                maxLength={MAX_BRIEF_ANSWER}
                onChange={(e) => set(i, { pick: null, own: e.target.value })}
                placeholder="Dis-le avec tes mots"
                aria-label={`Ta réponse : ${q.question}`}
                className="h-11 rounded-[12px] border-[1.5px] border-line bg-white px-3 text-[15px] outline-none focus:border-violet"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
