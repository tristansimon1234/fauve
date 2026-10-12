"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { saveStyle } from "./actions";
import { ArtDirectionSection } from "./art-direction-section";
import { ColorsSection } from "./colors-section";
import { FontsSection } from "./fonts-section";
import { LogoSection } from "./logo-section";
import { MoodboardSection } from "./moodboard-section";
import { StylePreview } from "./style-preview";
import {
  DEFAULT_ACCENT,
  MAX_COLORS,
  TEMPLATE_FONTS,
  TEMPLATES,
  fontStylesheet,
  type Logo,
  type MoodboardView,
  type StyleForm,
} from "./style-options";
import { TemplateSection } from "./template-section";
import { ToneSection } from "./tone-section";
import { useStylesheets } from "./use-stylesheet";

type SaveState = { status: "idle" } | { status: "ok"; version: number } | { status: "error"; message: string };

/** What the server stores: trimmed texts, no empty rules. */
function clean(form: StyleForm): StyleForm {
  const rules = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);
  return { ...form, art_direction: form.art_direction.trim(), tone: form.tone.trim(), dos: rules(form.dos), donts: rules(form.donts) };
}

const same = (a: StyleForm, b: StyleForm) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

// The template cards always show their own fonts.
const templateSheets = TEMPLATES.map((t) => fontStylesheet(TEMPLATE_FONTS[t].display));

export function StyleEditor({
  studioId,
  studioName,
  initial,
  version: initialVersion,
  logo: initialLogo,
  moodboard,
}: {
  studioId: string;
  studioName: string;
  initial: StyleForm;
  version: number | null;
  logo: Logo;
  moodboard: MoodboardView;
}) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [logo, setLogo] = useState(initialLogo);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  const dirty = !same(form, saved);
  const update = (patch: Partial<StyleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaveState({ status: "idle" });
  };

  const template = form.default_template ?? "doux";
  const displayFont = form.display_font ?? TEMPLATE_FONTS[template].display;
  const bodyFont = form.body_font ?? TEMPLATE_FONTS[template].body;
  useStylesheets([...new Set([...templateSheets, fontStylesheet(displayFont), fontStylesheet(bodyFont)])]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () => {
    const submitted = clean(form);
    startTransition(async () => {
      try {
        const result = await saveStyle(submitted);
        if (result.status === "error") {
          setSaveState(result);
          return;
        }
        setVersion(result.version);
        setSaved(submitted);
        setForm((f) => (same(f, submitted) ? submitted : f));
        setSaveState(result);
      } catch {
        setSaveState({ status: "error", message: "L’enregistrement a échoué. Vérifie ta connexion et réessaie." });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Style</h1>
        <p className="max-w-[640px] text-[15px] leading-normal text-muted">
          L’identité que Fauve applique à chacun de tes Reels : direction artistique, moodboard, couleurs, polices,
          logo et gabarit.
        </p>
        <p className="text-[13px] font-semibold text-muted">
          {version ? `Version ${version} en place.` : "Pas encore de style enregistré : voici des réglages de départ."}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <ArtDirectionSection value={form.art_direction} onChange={(art_direction) => update({ art_direction })} />
          <MoodboardSection
            studioId={studioId}
            initial={moodboard}
            onSaved={setVersion}
            onUsePalette={(colors) => update({ colors: colors.slice(0, MAX_COLORS) })}
          />
          <ColorsSection value={form.colors} onChange={(colors) => update({ colors })} />
          <FontsSection
            display={form.display_font}
            body={form.body_font}
            templateFonts={TEMPLATE_FONTS[template]}
            onChange={update}
          />
          <LogoSection
            studioId={studioId}
            studioName={studioName}
            logo={logo}
            onSaved={(v, l) => {
              setVersion(v);
              setLogo(l);
            }}
          />
          <TemplateSection value={form.default_template} onChange={(default_template) => update({ default_template })} />
          <ToneSection value={form} onChange={update} />
        </div>
        <aside aria-label="Aperçu du style" className="lg:sticky lg:top-6">
          <StylePreview
            template={template}
            accent={form.colors[0] ?? DEFAULT_ACCENT}
            displayFont={displayFont}
            bodyFont={bodyFont}
            logo={logo}
            studioName={studioName}
          />
        </aside>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-10 sm:px-10 lg:bottom-0">
        <p
          role={saveState.status === "error" ? "alert" : "status"}
          className={`min-w-0 flex-1 text-sm font-semibold ${
            saveState.status === "error" ? "text-danger" : saveState.status === "ok" ? "text-success" : "text-muted"
          }`}
        >
          {saveState.status === "error"
            ? saveState.message
            : saveState.status === "ok"
              ? `Style enregistré (version ${saveState.version}). Le prochain montage l’utilisera.`
              : pending
                ? "Enregistrement…"
                : dirty
                  ? "Modifications non enregistrées. Le prochain montage utilisera le style enregistré."
                  : "Le prochain montage de Fauve utilisera ce style."}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={pending || (!dirty && version !== null)}
          className="btn btn-primary disabled:opacity-50"
        >
          <CheckIcon size={18} />
          Enregistrer le style
        </button>
      </div>
    </div>
  );
}
