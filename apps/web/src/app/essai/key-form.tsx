"use client";

import { useActionState } from "react";
import { enterTest } from "./actions";

/** The test key, typed here (never in the address). */
export function KeyForm() {
  const [state, action, pending] = useActionState(enterTest, undefined);
  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <label htmlFor="key">Clé de test</label>
      <input id="key" name="key" type="password" autoComplete="off" required className="h-11 w-64 rounded-full border border-line bg-white px-4 text-ink" />
      <button type="submit" disabled={pending} className="btn btn-primary h-11">
        Entrer
      </button>
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
    </form>
  );
}
