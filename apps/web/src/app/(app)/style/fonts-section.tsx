"use client";

import { useId, useState } from "react";
import { CheckIcon } from "@/components/icons";
import {
  CURATED_FONTS,
  FONT_CATEGORY_LABELS,
  FONT_NAME,
  curatedFont,
  fontSampleStylesheet,
  fontStack,
  fontStylesheet,
  type FontCategory,
} from "./style-options";
import { Section, inputClass } from "./ui";
import { useStylesheet, useStylesheets } from "./use-stylesheet";

const sampleSheets = CURATED_FONTS.map((f) => fontSampleStylesheet(f.family));
const categories = Object.keys(FONT_CATEGORY_LABELS) as FontCategory[];

export function FontsSection({
  display,
  body,
  templateFonts,
  onChange,
  own,
}: {
  display: string | null;
  body: string | null;
  /** Fonts of the chosen template, used when none is picked. */
  templateFonts: { display: string; body: string };
  onChange: (fonts: { display_font?: string | null; body_font?: string | null }) => void;
  /** The studio's own font files. */
  own?: React.ReactNode;
}) {
  useStylesheets(sampleSheets);
  return (
    <Section
      id="style-fonts"
      title="Polices"
      hint="Laisse en automatique et Fauve choisit selon chaque vidéo, ou impose les tiennes (Google Fonts)."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FontPicker
          label="Titres et accroches"
          value={display}
          fallback={templateFonts.display}
          onChange={(family) => onChange({ display_font: family })}
        />
        <FontPicker
          label="Textes"
          value={body}
          fallback={templateFonts.body}
          onChange={(family) => onChange({ body_font: family })}
        />
      </div>
      {own}
    </Section>
  );
}

function FontPicker({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (family: string | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const status = useStylesheet(value ? fontStylesheet(value) : null);

  const q = query.trim().toLowerCase();
  const fonts = CURATED_FONTS.filter((f) => !q || f.family.toLowerCase().includes(q));
  const isCustom = value !== null && !curatedFont(value);

  const applyCustom = () => {
    const family = custom.trim().replace(/\s+/g, " ");
    if (!FONT_NAME.test(family)) {
      setCustomError("Lettres, chiffres et espaces seulement, 2 à 40 caractères.");
      return;
    }
    setCustomError(null);
    setCustom("");
    onChange(curatedFont(family)?.family ?? family);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2 text-[13px] font-bold">{label}</legend>
      <details className="group flex flex-col gap-2.5">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border-[1.5px] border-line bg-white px-3.5 hover:border-lilac group-open:border-violet [&::-webkit-details-marker]:hidden">
          <span className="truncate text-[17px]" style={{ fontFamily: fontStack(value ?? fallback) }}>
            {value ?? "Automatique"}
          </span>
          <span className="shrink-0 text-[13px] font-bold text-violet">Changer</span>
        </summary>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {status === "error" && (
            <p role="alert" className="text-[13px] font-semibold text-danger">
              Cette police est introuvable sur Google Fonts. Vérifie l’orthographe exacte.
            </p>
          )}
          <label htmlFor={`${id}-search`} className="sr-only">
            Rechercher une police ({label})
          </label>
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une police"
            className={inputClass}
          />
          <div className="max-h-72 overflow-y-auto rounded-[14px] border border-line p-1.5">
            <FontOption name={id} checked={value === null} onSelect={() => onChange(null)} family={fallback}>
              <span className="flex flex-col">
                <span>Automatique</span>
                <span className="font-sans text-xs font-medium text-muted">Fauve choisit selon la vidéo</span>
              </span>
            </FontOption>
            {isCustom && (
              <FontOption name={id} checked onSelect={() => undefined} family={value}>
                <span className="flex flex-col">
                  <span>{value}</span>
                  <span className="font-sans text-xs font-medium text-muted">Ta police</span>
                </span>
              </FontOption>
            )}
            {categories.map((category) => {
              const list = fonts.filter((f) => f.category === category);
              if (!list.length) return null;
              return (
                <div key={category} role="group" aria-label={FONT_CATEGORY_LABELS[category]}>
                  <p className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-[.06em] text-muted uppercase">
                    {FONT_CATEGORY_LABELS[category]}
                  </p>
                  {list.map((f) => (
                    <FontOption key={f.family} name={id} checked={value === f.family} onSelect={() => onChange(f.family)} family={f.family}>
                      {f.family}
                    </FontOption>
                  ))}
                </div>
              );
            })}
            {!fonts.length && <p className="px-3 py-2 text-sm text-muted">Aucune police de la sélection ne correspond.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-custom`} className="text-[13px] font-semibold text-muted">
              Une autre police Google Fonts
            </label>
            <div className="flex gap-2">
              <input
                id={`${id}-custom`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                maxLength={40}
                placeholder="Ex. Libre Baskerville"
                aria-invalid={customError ? true : undefined}
                aria-describedby={customError ? `${id}-custom-error` : undefined}
                className={inputClass}
              />
              <button type="button" onClick={applyCustom} className="btn btn-secondary h-11 shrink-0 px-4">
                Utiliser
              </button>
            </div>
            {customError && (
              <p id={`${id}-custom-error`} role="alert" className="text-[13px] font-semibold text-danger">
                {customError}
              </p>
            )}
          </div>
        </div>
      </details>
    </fieldset>
  );
}

function FontOption({
  name,
  checked,
  family,
  onSelect,
  children,
}: {
  name: string;
  checked: boolean;
  family: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[17px] hover:bg-soft has-checked:bg-violet-soft has-checked:text-violet has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet">
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span style={{ fontFamily: fontStack(family) }}>{children}</span>
      {checked && <CheckIcon size={16} className="shrink-0" />}
    </label>
  );
}
