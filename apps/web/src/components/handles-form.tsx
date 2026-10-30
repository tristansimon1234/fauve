"use client";

import { useActionState } from "react";
import { InstagramIcon, TikTokIcon } from "@/components/icons";
import { saveHandles, type HandlesState } from "@/app/handles-actions";

// Her @ instead of a connection (lib/social/connect.ts): « nombre d'abonnés / vue / j'aime c'est
// suffisant ». Used by the onboarding card, /connect and Réglages › Réseaux.

export function HandlesForm({
  instagram,
  tiktok,
  submit = "Enregistrer",
  onSaved,
}: {
  instagram: string | null;
  tiktok: string | null;
  submit?: string;
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: HandlesState, form: FormData) => {
    const next = await saveHandles(prev, form);
    if (next.ok) onSaved?.();
    return next;
  }, {});
  const field = (name: "instagram" | "tiktok", value: string | null) => (
    <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-2.5">
      {name === "instagram" ? <InstagramIcon size={18} className="shrink-0 text-violet" /> : <TikTokIcon size={18} className="shrink-0 text-violet" />}
      <span className="sr-only">{name === "instagram" ? "Ton @ Instagram" : "Ton @ TikTok"}</span>
      <input
        name={name}
        defaultValue={value ? `@${value}` : ""}
        placeholder={name === "instagram" ? "@ton.compte Instagram" : "@ton.compte TikTok (facultatif)"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
      />
    </label>
  );
  return (
    <form action={action} className="flex flex-col gap-2.5">
      {field("instagram", instagram)}
      {field("tiktok", tiktok)}
      {state.error && <p role="alert" className="text-[13px] font-semibold text-peach-ink">{state.error}</p>}
      {state.ok && !state.error && <p className="text-[13px] font-semibold text-violet">C’est noté : Edith suit tes chiffres depuis ce compte.</p>}
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "J’enregistre…" : submit}
      </button>
    </form>
  );
}
