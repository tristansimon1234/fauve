"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { saveStyle } from "./actions";
import { ArtDirectionSection } from "./art-direction-section";
import { ColorsSection } from "./colors-section";
import { FontsSection } from "./fonts-section";
import { LogoSection } from "./logo-section";
import { MoodboardSection } from "./moodboard-section";
import { ScenesSection, type SceneTemplate } from "./scenes-section";
import { MAX_COLORS, TEMPLATE_FONTS, fontStylesheet, type Logo, type MoodboardView, type StyleForm } from "./style-options";
import { ToneSection } from "./tone-section";
import { useStylesheets } from "./use-stylesheet";

type SaveState = { status: "idle" } | { status: "ok"; version: number } | { status: "error"; message: string };

/** What the server stores: trimmed texts, no empty rules. */
function clean(form: StyleForm): StyleForm {
  const rules = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);
  return { ...form, art_direction: form.art_direction.trim(), tone: form.tone.trim(), dos: rules(form.dos), donts: rules(form.donts) };
}

const same = (a: StyleForm, b: StyleForm) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

export function StyleEditor({
  studioId,
  studioName,
  initial,
  version: initialVersion,
  logo: initialLogo,
  moodboard,
  scenes,
  inspirations,
}: {
  studioId: string;
  studioName: string;
  initial: StyleForm;
  version: number | null;
  logo: Logo;
  moodboard: MoodboardView;
  scenes: SceneTemplate[];
  /** Server-rendered list of the Reels shared on Instagram. */
  inspirations: React.ReactNode;
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
  useStylesheets([...new Set([fontStylesheet(displayFont), fontStylesheet(bodyFont)])]);

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
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Style</h1>
        <p className="text-[15px] leading-normal text-muted">
          Ce que Fauve suit pour monter tes vidéos : tes inspirations, tes mots, ton logo, tes couleurs.
        </p>
      </header>

      <MoodboardSection
        studioId={studioId}
        initial={moodboard}
        onSaved={setVersion}
        onUsePalette={(colors) => update({ colors: colors.slice(0, MAX_COLORS) })}
      />
      {inspirations}
      <ArtDirectionSection value={form.art_direction} onChange={(art_direction) => update({ art_direction })} />
      <LogoSection
        studioId={studioId}
        studioName={studioName}
        logo={logo}
        onSaved={(v, l) => {
          setVersion(v);
          setLogo(l);
        }}
      />
      <ColorsSection value={form.colors} onChange={(colors) => update({ colors })} />
      <FontsSection display={form.display_font} body={form.body_font} templateFonts={TEMPLATE_FONTS[template]} onChange={update} />
      <ScenesSection initial={scenes} />
      <ToneSection value={form} onChange={update} />

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] border border-line bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgba(28,21,48,0.08)] backdrop-blur lg:bottom-4">
        <p
          role={saveState.status === "error" ? "alert" : "status"}
          className={`min-w-0 flex-1 text-sm font-semibold ${
            saveState.status === "error" ? "text-danger" : saveState.status === "ok" ? "text-success" : "text-muted"
          }`}
        >
          {saveState.status === "error"
            ? saveState.message
            : saveState.status === "ok"
              ? "Style enregistré. Le prochain montage l’utilisera."
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
