"use client";

import { answersText, type BriefQuestion } from "@fauve/agent";
import { useState } from "react";
import { BriefFields, briefAnswers, emptyPicks, type BriefPick } from "@/components/brief-fields";
import { ArrowUpIcon } from "@/components/icons";

// Simone's questions under her message before she makes something (reply_with questions):
// she taps an answer to each, or writes her own; one message carries them all. A question
// left open is Simone's to choose.

export function QuestionsCard({ questions, onSend, className = "" }: { questions: BriefQuestion[]; onSend: (text: string) => void; className?: string }) {
  const [picks, setPicks] = useState<BriefPick[]>(() => emptyPicks(questions));
  const answers = briefAnswers(questions, picks);
  const answered = answers.filter((a) => a.answer).length;
  return (
    <div className={`flex w-full max-w-[460px] flex-col gap-4 rounded-[18px] border border-line bg-white p-4 ${className}`}>
      <BriefFields questions={questions} picks={picks} onChange={setPicks} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" onClick={() => onSend(answersText(answers))} className="btn btn-primary h-10 px-4 text-[14px]">
          <ArrowUpIcon size={15} />
          {answered ? "Envoyer" : "Choisis pour moi"}
        </button>
        {answered > 0 && answered < questions.length && <span className="text-[12.5px] text-muted">Le reste, je choisis.</span>}
      </div>
    </div>
  );
}
