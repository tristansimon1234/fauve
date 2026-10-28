"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DEFAULT_VOICE_ID, SIMONE_VOICES, voiceSamplePath } from "@fauve/agent";
import { CloneVoice } from "@/app/(app)/style/voice-section";
import type { OwnVoiceView } from "@/app/(app)/style/actions";
import { CheckIcon, PauseIcon, PlayIcon, WhatsAppIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { publicEnv, whatsappLink } from "@/lib/public-env";
import { chooseVoice } from "./actions";

const SAMPLES = `${publicEnv.supabaseUrl}/storage/v1/object/public/landing`;

type Use = "auto" | "always" | "never";
const USES: { value: Use; label: string; hint: string }[] = [
  { value: "auto", label: "Quand ça raconte", hint: "Quand tes images racontent quelque chose et que personne ne parle déjà dedans." },
  { value: "always", label: "Sur tous mes Reels", hint: "Chaque nouveau Reel a sa voix off (ton propre vocal passe toujours avant)." },
  { value: "never", label: "Jamais", hint: "Juste la musique. Tu peux toujours en demander une pour un Reel précis." },
];

/** Hear the voices, pick one (hers first when she cloned it), say when; or clone her own. Then back to WhatsApp. */
export function VoiceView({ studioId, initial, own: initialOwn }: { studioId: string; initial: { use: Use; voiceId: string | null }; own: OwnVoiceView | null }) {
  const [own, setOwn] = useState(initialOwn);
  const [use, setUse] = useState<Use>(initial.use);
  const [voiceId, setVoiceId] = useState(initial.voiceId ?? DEFAULT_VOICE_ID);
  const [cloning, setCloning] = useState(false);
  const [done, setDone] = useState<{ answered: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const listen = (id: string, url: string) => {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const sample = new Audio(url);
    audio.current = sample;
    sample.onended = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    sample.play().catch(() => setPlaying(null));
  };

  const save = (next: { use: Use; voiceId: string }) =>
    start(async () => {
      setError(null);
      audio.current?.pause();
      const res = await chooseVoice({ use: next.use, voice_id: next.voiceId }).catch(() => ({ ok: false as const, error: "Ce n’est pas enregistré. Réessaie." }));
      if (!res.ok) return setError(res.error);
      setDone({ answered: res.answered });
    });

  if (done) {
    const mine = voiceId === own?.id;
    const name = mine ? "ta voix" : (SIMONE_VOICES.find((v) => v.id === voiceId)?.name ?? "");
    return (
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-white">
        <Mascot size={96} mood="happy" />
        <h1 className="text-[24px] font-extrabold tracking-[-0.01em]">C’est noté !</h1>
        <p className="text-[15px] leading-snug text-white/80">
          {use === "never" ? "Tes Reels n’auront que leur musique." : `Tes Reels seront racontés ${mine ? "avec ta propre voix" : `par ${name}`}.`}{" "}
          {done.answered ? "Je te l’ai redit sur WhatsApp." : "Tu peux retourner sur WhatsApp."}
        </p>
        <a
          href={whatsappLink(done.answered ? "" : use === "never" ? "C’est noté pour la voix : juste la musique." : `C’est noté pour la voix : ${mine ? "ma voix" : name} 🎙️`)}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-extrabold text-ink"
        >
          <WhatsAppIcon size={18} /> Retourner sur WhatsApp
        </a>
        <button type="button" onClick={() => setDone(null)} className="text-[13.5px] font-semibold text-white/70 underline underline-offset-3">
          Changer encore
        </button>
      </main>
    );
  }

  const voices = [
    ...(own ? [{ id: own.id, name: "Ta voix", hint: "Clonée, rien qu’à toi", url: own.sampleUrl }] : []),
    ...SIMONE_VOICES.map((v) => ({ id: v.id as string, name: v.name as string, hint: `${v.hint.charAt(0).toUpperCase()}${v.hint.slice(1)}`, url: `${SAMPLES}/${voiceSamplePath(v.id)}` as string | null })),
  ];
  return (
    <div className="min-h-dvh bg-soft text-ink">
    <main className="mx-auto flex max-w-[480px] flex-col gap-6 px-4 pt-8 pb-32">
      <div className="flex items-center gap-3">
        <Mascot size={56} mood="idle" />
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.01em]">La voix de tes Reels</h1>
          <p className="text-[14px] leading-snug text-muted">Écoute, choisis. La musique passe dessous.</p>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold tracking-[0.04em] text-muted uppercase">Quand mettre une voix</h2>
        <div role="radiogroup" aria-label="Quand mettre une voix" className="grid grid-cols-3 gap-1.5">
          {USES.map((u) => (
            <button
              key={u.value}
              type="button"
              role="radio"
              aria-checked={use === u.value}
              onClick={() => setUse(u.value)}
              className={`min-h-12 rounded-[14px] border-[1.5px] px-2 text-[13.5px] leading-tight font-extrabold ${use === u.value ? "border-violet bg-violet-tint text-violet" : "border-line bg-white"}`}
            >
              {u.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] leading-snug text-muted">{USES.find((u) => u.value === use)!.hint}</p>
      </section>

      <section className={`flex flex-col gap-2 ${use === "never" ? "opacity-50" : ""}`}>
        <h2 className="text-[13px] font-bold tracking-[0.04em] text-muted uppercase">La voix</h2>
        <div role="radiogroup" aria-label="La voix" className="flex flex-col gap-1.5">
          {voices.map((v) => {
            const on = voiceId === v.id;
            return (
              <div key={v.id} className={`flex items-center gap-2 rounded-[16px] border-[1.5px] py-1 pr-1.5 pl-4 ${on ? "border-violet bg-violet-tint" : "border-line bg-white"}`}>
                <button type="button" role="radio" aria-checked={on} disabled={use === "never"} onClick={() => setVoiceId(v.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[15.5px] font-extrabold">{v.name}</span>
                    <span className="truncate text-[13px] text-muted">{v.hint}</span>
                  </span>
                  {on ? <CheckIcon size={16} className="ml-auto shrink-0 text-violet" /> : null}
                </button>
                {v.url ? (
                  <button
                    type="button"
                    onClick={() => listen(v.id, v.url!)}
                    aria-label={playing === v.id ? `Arrêter ${v.name}` : `Écouter ${v.name}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-chip text-ink"
                  >
                    {playing === v.id ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        {own && !cloning ? (
          <button type="button" onClick={() => setCloning(true)} className="self-start text-[13.5px] font-bold text-violet">
            Refaire ma voix
          </button>
        ) : (
          <CloneVoice
            studioId={studioId}
            open={cloning}
            onOpen={() => setCloning(true)}
            onClose={() => setCloning(false)}
            onCloned={(voice) => {
              setOwn(voice);
              setCloning(false);
              setVoiceId(voice.id);
              if (use === "never") setUse("auto");
              if (voice.sampleUrl) listen(voice.id, voice.sampleUrl);
            }}
          />
        )}
      </section>

      {error ? (
        <p role="alert" className="text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <button
          type="button"
          disabled={pending || cloning}
          onClick={() => save({ use, voiceId })}
          className="mx-auto flex h-12 w-full max-w-[448px] items-center justify-center rounded-full bg-violet text-[16px] font-extrabold text-white disabled:opacity-50"
        >
          {pending ? "J’enregistre…" : use === "never" ? "Juste la musique" : "C’est cette voix"}
        </button>
      </div>
    </main>
    </div>
  );
}
