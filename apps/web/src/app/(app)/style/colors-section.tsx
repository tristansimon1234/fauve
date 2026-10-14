"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "@/components/icons";
import { COLOR_SUGGESTIONS, DEFAULT_ACCENT, HEX_COLOR, MAX_COLORS } from "./style-options";
import { Section } from "./ui";

export function ColorsSection({ value, onChange }: { value: string[]; onChange: (colors: string[]) => void }) {
  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    onChange(next);
  };
  const add = () => {
    const color = COLOR_SUGGESTIONS.find((c) => !value.includes(c)) ?? DEFAULT_ACCENT;
    onChange([...value, color]);
  };

  return (
    <Section
      id="style-colors"
      title="Couleurs"
      hint="Jusqu’à 6 couleurs. La première est la couleur principale : bandeaux, mots mis en avant, bouton de fin."
    >
      {value.length === 0 ? (
        <p className="rounded-[14px] bg-soft px-4 py-3 text-sm text-muted">
          Aucune couleur : Simone utilise son violet par défaut.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {value.map((color, i) => (
            <ColorRow
              key={i}
              index={i}
              color={color}
              count={value.length}
              onChange={(c) => onChange(value.map((v, j) => (j === i ? c : v)))}
              onMove={(to) => move(i, to)}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={add}
        disabled={value.length >= MAX_COLORS}
        className="flex w-fit items-center gap-1.5 rounded-full px-1 py-1 text-sm font-bold text-violet disabled:opacity-50"
      >
        <PlusIcon size={18} />
        Ajouter une couleur
      </button>
    </Section>
  );
}

function ColorRow({
  index,
  color,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  color: string;
  count: number;
  onChange: (color: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  // The hex field keeps what is typed until it is a full colour.
  const [draft, setDraft] = useState(color);
  const [shown, setShown] = useState(color);
  if (color !== shown) {
    setShown(color);
    setDraft(color);
  }
  const invalid = !HEX_COLOR.test(draft);
  const name = index === 0 ? "Couleur principale" : `Couleur ${index + 1}`;
  const iconButton =
    "flex size-10 items-center justify-center rounded-xl border-[1.5px] border-line text-muted hover:text-ink disabled:opacity-40 disabled:hover:text-muted";

  return (
    <li className="flex flex-wrap items-center gap-2.5 rounded-[16px] border border-line p-2.5 sm:flex-nowrap">
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        aria-label={`${name} : choisir la couleur`}
        className="size-11 shrink-0 cursor-pointer rounded-xl border-[1.5px] border-line bg-white p-1"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-bold">
          <span className={index === 0 ? "text-violet" : "text-muted"}>{name}</span>
          {index > 0 && (
            <button type="button" onClick={() => onMove(0)} className="font-semibold text-violet underline-offset-2 hover:underline">
              Mettre en principale
            </button>
          )}
        </span>
        <input
          value={draft}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const next = raw.startsWith("#") ? raw : `#${raw}`;
            setDraft(next);
            if (HEX_COLOR.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setDraft(color)}
          maxLength={7}
          spellCheck={false}
          aria-label={`${name} : code hexadécimal`}
          aria-invalid={invalid}
          className={`h-9 w-full max-w-[140px] rounded-lg border-[1.5px] bg-white px-2.5 font-mono text-sm uppercase focus:outline-none ${
            invalid ? "border-danger" : "border-line focus:border-violet"
          }`}
        />
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} aria-label={`Monter la ${name.toLowerCase()}`} className={iconButton}>
          <ArrowUpIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={index === count - 1}
          aria-label={`Descendre la ${name.toLowerCase()}`}
          className={iconButton}
        >
          <ArrowDownIcon size={16} />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Retirer la ${name.toLowerCase()}`} className={iconButton}>
          <XIcon size={16} />
        </button>
      </div>
    </li>
  );
}
