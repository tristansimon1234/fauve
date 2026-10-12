"use client";

import { formatPhone } from "@mila/agent";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { sendCode, verifyCode, type LoginState } from "./actions";

const inputClass =
  "h-14 w-full rounded-2xl border-[1.5px] border-line bg-white px-4 text-lg font-semibold outline-none focus:border-violet";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/mila";
  const expiredLink = params.get("lien") === "expire";

  // Re-mounting on "Changer de numéro" resets both actions.
  const [attempt, setAttempt] = useState(0);
  return (
    <Steps key={attempt} next={next} expiredLink={expiredLink} onRestart={() => setAttempt((n) => n + 1)} />
  );
}

function Steps({ next, expiredLink, onRestart }: { next: string; expiredLink: boolean; onRestart: () => void }) {
  const [sent, send, sending] = useActionState<LoginState, FormData>(sendCode, { step: "phone" });
  const [verified, verify, verifying] = useActionState<LoginState, FormData>(verifyCode, { step: "phone" });

  if (sent.step === "phone") {
    const state = sent;
    return (
      <form action={send} className="flex flex-col gap-4">
        {expiredLink && <Notice>Ce lien a expiré. Reçois un nouveau code ci-dessous.</Notice>}
        <label htmlFor="phone" className="text-[13px] font-bold">
          Ton numéro WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          required
          className={inputClass}
        />
        {state.error && <ErrorText>{state.error}</ErrorText>}
        <button type="submit" disabled={sending} className="btn btn-primary h-[54px] text-base disabled:opacity-60">
          <WhatsAppIcon />
          {sending ? "Envoi…" : "Recevoir mon code"}
        </button>
      </form>
    );
  }

  const error = verified.error;
  return (
    <form action={verify} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="phone" value={sent.phone} />
      <Notice>Code envoyé sur WhatsApp au {formatPhone(sent.phone)}.</Notice>
      <label htmlFor="code" className="text-[13px] font-bold">
        Code reçu
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={12}
        required
        autoFocus
        className={`${inputClass} text-center tracking-[0.3em]`}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <button type="submit" disabled={verifying} className="btn btn-primary h-[54px] text-base disabled:opacity-60">
        {verifying ? "Vérification…" : "Me connecter"}
      </button>
      <button type="button" onClick={onRestart} className="text-sm font-bold text-violet">
        Changer de numéro
      </button>
    </form>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-soft px-4 py-3 text-sm leading-normal">{children}</p>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm font-semibold text-danger">
      {children}
    </p>
  );
}
