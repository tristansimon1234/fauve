import Link from "next/link";

// On a phone, Réglages groups the studio's settings: accounts and plan, style, components, media library.
const tabs = [
  { href: "/reglages", label: "Compte" },
  { href: "/style", label: "Style" },
  { href: "/composants", label: "Composants" },
  { href: "/mediatheque", label: "Médiathèque" },
] as const;

export function SettingsTabs({ current }: { current: (typeof tabs)[number]["href"] }) {
  return (
    // On a phone only: on a computer, Médiathèque and Style are in the side menu.
    <nav aria-label="Réglages" className="-mb-2 flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-soft p-1 [scrollbar-width:none] lg:hidden">
      {tabs.map((tab) => {
        const on = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${on ? "bg-white text-ink shadow-[0_2px_8px_rgba(28,21,48,0.08)]" : "text-muted hover:text-ink"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
