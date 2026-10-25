"use client";

import { useEffect, useSyncExternalStore } from "react";

// On a computer, Réglages in tabs like Ton style (Tristan: « page reglages il faudra la mettre sous forme
// d'onglet aussi ») ; on a phone, the sections follow one another. The tab lives in the address (#reseaux).
const TABS = [
  { key: "commerce", label: "Mon commerce" },
  { key: "reseaux", label: "Réseaux" },
  { key: "montages", label: "Montages" },
  { key: "abonnement", label: "Abonnement et crédits" },
  { key: "compte", label: "Mon compte" },
] as const;
export type SettingsTab = (typeof TABS)[number]["key"];
/** Sections linked to from elsewhere (the credits in the menu, #credits), and the tab that holds them. */
const ANCHORS = new Map<string, SettingsTab>([["credits", "abonnement"]]);
const tabOf = (hash: string): SettingsTab => TABS.find((t) => t.key === hash)?.key ?? ANCHORS.get(hash) ?? "commerce";
const onAddressChange = (notify: () => void) => {
  // A link of the app changes the address with pushState, which fires no hashchange (the credits in the menu,
  // clicked on another tab): the Navigation API sees it, where the browser has it. Next pushes the address while
  // React commits, which must not schedule an update: the tab follows just after.
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  const afterCommit = () => queueMicrotask(notify);
  window.addEventListener("hashchange", notify);
  navigation?.addEventListener("currententrychange", afterCommit);
  return () => {
    window.removeEventListener("hashchange", notify);
    navigation?.removeEventListener("currententrychange", afterCommit);
  };
};

export function SettingsPanels({ panels }: { panels: Record<SettingsTab, React.ReactNode> }) {
  const hash = useSyncExternalStore(onAddressChange, () => window.location.hash.slice(1), () => "");
  const tab = tabOf(hash);
  const choose = (next: SettingsTab) => {
    window.history.replaceState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  // Hidden in another tab, the section could not be scrolled to: once its tab is open, it comes into view.
  useEffect(() => {
    if (ANCHORS.has(hash)) document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <>
      <nav aria-label="Réglages" role="tablist" className="sticky top-0 z-20 -mx-1 hidden gap-1 border-b border-line bg-white/95 px-1 pt-1 backdrop-blur lg:flex">
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
      {TABS.map((t) => (
        // A tab's sections: always on a phone, only the chosen tab's on a computer.
        <div key={t.key} role="tabpanel" className={`flex flex-col gap-4 ${tab === t.key ? "" : "lg:hidden"}`}>
          {panels[t.key]}
        </div>
      ))}
    </>
  );
}
