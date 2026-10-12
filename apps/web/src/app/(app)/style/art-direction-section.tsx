"use client";

import { ART_DIRECTION_MAX } from "./style-options";
import { Section } from "./ui";

export function ArtDirectionSection({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const left = ART_DIRECTION_MAX - value.length;
  return (
    <Section
      id="style-da"
      title="Direction artistique"
      hint="Décris l’univers de tes vidéos avec tes mots : ambiance, couleurs, typographie, rythme, ce que tu aimes et ce que tu évites. Fauve le relit avant chaque montage."
    >
      <label htmlFor="art-direction" className="sr-only">
        Direction artistique
      </label>
      <textarea
        id="art-direction"
        rows={7}
        maxLength={ART_DIRECTION_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Minimaliste et lumineux, tons terracotta et crème, typographie éditoriale, mouvements lents, beaucoup d’espace, jamais de néon."
        aria-describedby="art-direction-count"
        className="w-full resize-y rounded-[14px] border-[1.5px] border-line bg-white px-4 py-3.5 text-[15px] leading-relaxed placeholder:text-muted/70 focus:border-violet focus:outline-none"
      />
      <p
        id="art-direction-count"
        className={`self-end text-[13px] tabular-nums ${left < 100 ? "font-semibold text-peach-ink" : "text-muted"}`}
      >
        {value.length} / {ART_DIRECTION_MAX}
      </p>
    </Section>
  );
}
