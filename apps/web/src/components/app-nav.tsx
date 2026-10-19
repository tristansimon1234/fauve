"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, ChatIcon, FolderIcon, GridIcon, PaletteIcon, SlidersIcon } from "./icons";

// The work (talk to Simone, the Instagram grid with every publication, the
// results; no calendar: she does not plan, Simone does), the studio's material (media library,
// her style with what Simone made for her) and the settings. On a phone the bar keeps four
// places: Médiathèque and Ton style open from Réglages' tabs.
// `also`: the pages that belong to a section, to highlight it.
const nav = [
  { href: "/fauve", label: "Simone", icon: ChatIcon, also: [], group: "work" },
  { href: "/grille", label: "Grille", icon: GridIcon, also: ["/publications", "/calendrier"], group: "work" },
  { href: "/resultats", label: "Résultats", icon: ChartIcon, also: [], group: "work" },
  { href: "/mediatheque", label: "Médiathèque", icon: FolderIcon, also: [], group: "studio" },
  { href: "/style", label: "Ton style", icon: PaletteIcon, also: ["/composants"], group: "studio" },
  { href: "/reglages", label: "Réglages", icon: SlidersIcon, also: [], group: "settings" },
] as const;
const barAlso: Record<string, string[]> = { "/reglages": ["/style", "/mediatheque", "/composants"] };

type Variant = "sidebar" | "bar";

/** Navigation links with the current page highlighted. */
export function NavLinks({ variant }: { variant: Variant }) {
  return <NavList variant={variant} pathname={usePathname()} />;
}

/** Same links; `pathname` null renders them without highlight (prerendered fallback). */
export function NavList({ variant, pathname }: { variant: Variant; pathname: string | null }) {
  const isActive = (href: string) => {
    const item = nav.find((n) => n.href === href)!;
    const also: readonly string[] = variant === "bar" ? [...item.also, ...(barAlso[href] ?? [])] : item.also;
    return pathname !== null && [href, ...also].some((h) => pathname === h || pathname.startsWith(`${h}/`));
  };

  if (variant === "sidebar") {
    return nav.map(({ href, label, icon: Icon, group }, i) => {
      const active = isActive(href);
      // A little space between the groups.
      const gap = i > 0 && nav[i - 1]!.group !== group ? "mt-4" : "";
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] ${gap} ${
            active ? "bg-violet-soft font-bold text-violet" : "font-medium text-muted hover:text-ink"
          }`}
        >
          <Icon />
          {label}
        </Link>
      );
    });
  }

  return nav.filter((n) => n.group !== "studio").map(({ href, label, icon: Icon }) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold ${
          active ? "text-violet" : "text-muted"
        }`}
      >
        <Icon size={22} />
        {label}
      </Link>
    );
  });
}
