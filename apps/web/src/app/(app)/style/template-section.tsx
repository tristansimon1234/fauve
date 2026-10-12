"use client";

import { CheckIcon } from "@/components/icons";
import { TemplateMini } from "./style-preview";
import { TEMPLATE_FONTS, TEMPLATE_LABELS, TEMPLATES, type Template } from "./style-options";
import { Section } from "./ui";

const INFO: Record<Template, { description: string; words: string[] }> = {
  doux: {
    description: "Serif en italique, mots qui montent en douceur, bandeaux arrondis. Pour le yoga, le Pilates tout en calme.",
    words: ["respire", "doucement"],
  },
  dynamique: {
    description: "Capitales grasses qui surgissent, coupes rapides, bandeau penché. Pour la barre, le cardio, l’énergie.",
    words: ["Bouge", "fort"],
  },
  chic: {
    description: "Lettres fines, apparitions lentes, beaucoup d’espace. Pour un studio boutique, élégant et épuré.",
    words: ["l’essentiel"],
  },
};

export function TemplateSection({ value, onChange }: { value: Template | null; onChange: (template: Template | null) => void }) {
  return (
    <Section
      id="style-template"
      title="Gabarit par défaut"
      hint={
        value
          ? "Fauve monte tes Reels avec ce gabarit, sauf si tu lui demandes autre chose pour un post."
          : "Aucun gabarit choisi : Fauve choisit à chaque montage selon le contenu."
      }
    >
      <fieldset>
        <legend className="sr-only">Gabarit par défaut</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((template) => (
            <label
              key={template}
              className="flex cursor-pointer flex-col gap-3 rounded-[18px] border-[1.5px] border-line p-3 hover:border-lilac has-checked:border-violet has-checked:bg-violet-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet"
            >
              <input
                type="radio"
                name="default-template"
                value={template}
                checked={value === template}
                onChange={() => onChange(template)}
                className="sr-only"
              />
              <TemplateMini template={template} displayFont={TEMPLATE_FONTS[template].display} words={INFO[template].words} />
              <span className="flex items-center justify-between gap-2 px-1 text-[15px] font-bold">
                {TEMPLATE_LABELS[template]}
                {value === template && <CheckIcon size={18} className="text-violet" />}
              </span>
              <span className="px-1 pb-1 text-[13px] leading-snug text-muted">{INFO[template].description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="w-fit text-sm font-bold text-violet underline-offset-2 hover:underline">
          Laisser Fauve choisir à chaque montage
        </button>
      )}
    </Section>
  );
}
