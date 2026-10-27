"use client";

import { useEffect, useRef, useState } from "react";
import { SIMONE_VOICES, voiceSamplePath } from "@fauve/agent";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { publicEnv } from "@/lib/public-env";
import type { StyleForm } from "./style-options";
import { FoldedSection, Segmented } from "./ui";

// Edith's voice over the Reels: when she puts one, and which of her voices (each
// one heard reading the same lines, from the public bucket). Her own voice note,
// when she sends one, always comes first.

const SAMPLES = `${publicEnv.supabaseUrl}/storage/v1/object/public/landing`;

const USE_OPTIONS = [
  { value: "auto", label: "Quand ça raconte" },
  { value: "always", label: "Sur tous mes Reels" },
  { value: "never", label: "Jamais" },
] as const;

const USE_HINTS: Record<StyleForm["voice_use"], string> = {
  auto: "Edith en pose une quand tes images racontent quelque chose (un geste, un avant/après, une histoire) et que personne ne parle déjà dans tes vidéos.",
  always: "Chaque nouveau Reel a sa voix off, sauf quand tu m’envoies ton propre vocal : c’est lui qui passe.",
  never: "Tes Reels n’ont que leur musique. Tu peux toujours en demander une pour un Reel précis.",
};

type VoiceFields = Pick<StyleForm, "voice_use" | "voice_id">;

export function VoiceSection({ value, onChange }: { value: VoiceFields; onChange: (patch: Partial<VoiceFields>) => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const listen = (id: string) => {
    audio.current?.pause();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const sample = new Audio(`${SAMPLES}/${voiceSamplePath(id)}`);
    audio.current = sample;
    sample.onended = () => setPlaying((current) => (current === id ? null : current));
    setPlaying(id);
    sample.play().catch(() => setPlaying(null));
  };

  return (
    <FoldedSection title="Voix off" hint="Une vraie voix qui raconte tes Reels. La musique passe dessous.">
      <Segmented legend="Quand mettre une voix" name="voice-use" value={value.voice_use} options={USE_OPTIONS} onChange={(voice_use) => onChange({ voice_use })} />
      <p className="text-[13px] leading-snug text-muted">{USE_HINTS[value.voice_use]}</p>
      <fieldset className="flex flex-col gap-2" disabled={value.voice_use === "never"}>
        <legend className="mb-2 text-[13px] font-bold">La voix</legend>
        <div role="radiogroup" aria-label="La voix de tes Reels" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {SIMONE_VOICES.map((voice) => {
            const chosen = value.voice_id === voice.id;
            return (
              <div
                key={voice.id}
                className={`flex items-center gap-2 rounded-[16px] border p-2.5 transition-colors ${chosen ? "border-violet bg-violet-soft" : "border-line bg-white"} ${value.voice_use === "never" ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => onChange({ voice_id: voice.id })}
                  className="flex min-w-0 flex-1 flex-col text-left leading-tight"
                >
                  <span className="text-[14px] font-bold">{voice.name}</span>
                  <span className="truncate text-[12px] text-muted">{voice.hint}</span>
                </button>
                <button
                  type="button"
                  onClick={() => listen(voice.id)}
                  aria-label={playing === voice.id ? `Arrêter ${voice.name}` : `Écouter ${voice.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-ink transition-colors hover:bg-violet-tint"
                >
                  {playing === voice.id ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>
    </FoldedSection>
  );
}
