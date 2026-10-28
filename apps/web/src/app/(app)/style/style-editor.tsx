"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { CheckIcon } from "@/components/icons";
import { saveStyle } from "./actions";
import { ArtDirectionSection } from "./art-direction-section";
import { ColorsSection } from "./colors-section";
import type { OwnFont, OwnVoiceView } from "./actions";
import { FontsSection } from "./fonts-section";
import { OwnFonts } from "./own-fonts";
import { LogoSection } from "./logo-section";
import { MoodboardSection } from "./moodboard-section";
import { DEFAULT_FONTS, MAX_COLORS, fontStylesheet, type Logo, type MoodboardView, type StyleForm } from "./style-options";
import { ToneSection } from "./tone-section";
import { VoiceSection } from "./voice-section";
import { useStylesheets } from "./use-stylesheet";

type SaveState = { status: "idle" } | { status: "ok"; version: number } | { status: "error"; message: string };

// On a computer, her style in tabs rather than one long page (Tristan: « fais un système d'onglets sur desktop
// plutôt que tout à la suite ») ; on a phone, the sections follow one another. One save bar for all of them.
const TABS = [
  { key: "inspirations", label: "Inspirations" },
  { key: "identite", label: "Logo et couleurs" },
  { key: "polices", label: "Polices" },
  { key: "voix", label: "Voix et ton" },
  { key: "creations", label: "Tes créations" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const isTab = (v: string): v is Tab => TABS.some((t) => t.key === v);
const onHashChange = (notify: () => void) => {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
};

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
  inspirations,
  created,
  ownFonts,
  ownVoice,
}: {
  studioId: string;
  studioName: string;
  initial: StyleForm;
  version: number | null;
  logo: Logo;
  moodboard: MoodboardView;
  /** Server-rendered list of the Reels shared on Instagram. */
  inspirations: React.ReactNode;
  /** Server-rendered: what Edith made for the studio and reuses (animations, text styles). */
  created?: React.ReactNode;
  /** The studio's own font files, with signed links. */
  ownFonts: OwnFont[];
  /** Her own voice (a clone), with its sample's signed link. */
  ownVoice: OwnVoiceView | null;
}) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [logo, setLogo] = useState(initialLogo);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  // The tab lives in the address (#polices): a link or a reload opens it again.
  const hash = useSyncExternalStore(onHashChange, () => window.location.hash.slice(1), () => "");
  const tab: Tab = isTab(hash) ? hash : "inspirations";
  const choose = (next: Tab) => {
    window.history.replaceState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  /** A tab's sections: always on a phone, only the chosen tab's on a computer. */
  const panel = (key: Tab) => `flex flex-col gap-5 ${tab === key ? "" : "lg:hidden"}`;

  const dirty = !same(form, saved);
  const update = (patch: Partial<StyleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaveState({ status: "idle" });
  };

  const displayFont = form.display_font ?? DEFAULT_FONTS.display;
  const bodyFont = form.body_font ?? DEFAULT_FONTS.body;
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
        <h1 className="text-[34px] font-extrabold tracking-[-0.02em]">Ton style</h1>
        <p className="text-[15px] leading-normal text-muted">
          Ce qu’Edith suit pour tes Reels et tes carrousels : tes inspirations, ton logo, tes couleurs, tes polices, ta voix et tes mots. Et ce qu’elle a déjà créé pour toi.
        </p>
      </header>

      <nav aria-label="Ton style" role="tablist" className="sticky top-0 z-20 -mx-1 hidden gap-1 border-b border-line bg-white/95 px-1 pt-1 backdrop-blur lg:flex">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => choose(t.key)}
            className={`-mb-px border-b-2 px-3.5 py-3 text-[14.5px] font-bold ${tab === t.key ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div role="tabpanel" className={panel("inspirations")}>
        <MoodboardSection
          studioId={studioId}
          initial={moodboard}
          onSaved={setVersion}
          onUsePalette={(colors) => update({ colors: colors.slice(0, MAX_COLORS) })}
        />
        {inspirations}
        <ArtDirectionSection value={form.art_direction} onChange={(art_direction) => update({ art_direction })} />
      </div>
      <div role="tabpanel" className={panel("identite")}>
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
      </div>
      <div role="tabpanel" className={panel("polices")}>
        <FontsSection
          display={form.display_font}
          body={form.body_font}
          templateFonts={DEFAULT_FONTS}
          onChange={update}
          own={<OwnFonts studioId={studioId} initial={ownFonts} display={form.display_font} body={form.body_font} onUse={update} />}
        />
      </div>
      <div role="tabpanel" className={panel("voix")}>
        <VoiceSection
          value={form}
          onChange={update}
          studioId={studioId}
          ownVoice={ownVoice}
          // Her clone is kept by the server, which also moves a setting off a deleted one: the saved form follows.
          onOwnVoice={(patch) => {
            update(patch);
            setSaved((s) => ({ ...s, ...patch }));
          }}
        />
        <ToneSection value={form} onChange={update} />
      </div>
      <div role="tabpanel" className={panel("creations")}>
        {/* Nothing made yet: on a computer, a line says so (on a phone, the section is just absent). */}
        <div className="peer flex flex-col gap-5">{created}</div>
        <p className="hidden rounded-[18px] border border-dashed border-line px-5 py-8 text-center text-[14.5px] text-muted lg:peer-empty:block">
          Edith n’a encore rien créé pour toi : ses animations et tes styles de texte apparaîtront ici après tes premiers Reels.
        </p>
      </div>

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
                  : "Le prochain montage d’Edith utilisera ce style."}
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
