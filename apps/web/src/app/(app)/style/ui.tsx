"use client";

import { useId, useState } from "react";
import { PlusIcon, XIcon } from "@/components/icons";

// Small form pieces shared by the Style sections.

export const inputClass =
  "h-11 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 text-[15px] placeholder:text-muted/70 focus:border-violet focus:outline-none";

export function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="card flex flex-col gap-4 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {hint && <p className="text-sm leading-normal text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Pill-shaped radio group. */
export function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-bold">{legend}</legend>
      <div className="inline-flex w-fit flex-wrap gap-1 rounded-full bg-chip p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-muted has-checked:bg-white has-checked:text-ink has-checked:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Hashtags as removable chips; Entrée, espace or virgule adds one. */
export function HashtagInput({
  value,
  max,
  onChange,
  validate,
}: {
  value: string[];
  max: number;
  onChange: (tags: string[]) => void;
  validate: (tag: string) => boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const tag = draft.trim().replace(/^#+/, "");
    if (!tag) return;
    if (!validate(tag)) {
      setError("Un hashtag ne contient que des lettres, des chiffres et _ (sans espace).");
      return;
    }
    if (value.length >= max) {
      setError(`${max} hashtags au maximum.`);
      return;
    }
    setError(null);
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-bold">
        Hashtags récurrents
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Hashtags">
          {value.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full bg-violet-soft py-1 pr-1 pl-3 text-sm font-semibold text-violet">
              #{tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Retirer #${tag}`}
                className="flex size-6 items-center justify-center rounded-full hover:bg-white"
              >
                <XIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="pilatesparis"
          aria-describedby={error ? `${id}-error` : undefined}
          className={inputClass}
        />
        <button type="button" onClick={add} className="btn btn-secondary h-11 shrink-0 px-4">
          Ajouter
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Editable list of short rules (à faire / à éviter). */
export function RuleList({
  label,
  addLabel,
  placeholder,
  value,
  max,
  maxLength,
  onChange,
}: {
  label: string;
  addLabel: string;
  placeholder: string;
  value: string[];
  max: number;
  maxLength: number;
  onChange: (items: string[]) => void;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-bold">{label}</legend>
      {value.length === 0 && <p className="text-sm text-muted">Rien pour l’instant.</p>}
      <ul className="flex flex-col gap-2">
        {value.map((item, i) => (
          <li key={i} className="flex gap-2">
            <input
              id={`${id}-${i}`}
              value={item}
              maxLength={maxLength}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={placeholder}
              aria-label={`${label}, règle ${i + 1}`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Retirer la règle ${i + 1}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-line text-muted hover:text-ink"
            >
              <XIcon size={18} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={value.length >= max}
        onClick={() => onChange([...value, ""])}
        className="flex w-fit items-center gap-1.5 rounded-full px-1 py-1 text-sm font-bold text-violet disabled:opacity-50"
      >
        <PlusIcon size={18} />
        {addLabel}
      </button>
    </fieldset>
  );
}
