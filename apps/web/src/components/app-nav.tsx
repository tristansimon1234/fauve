"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChartIcon, ChatIcon, SlidersIcon } from "./icons";

// Four places: talk to Fauve, the calendar (week and grid, every publication),
// the results, and the settings (accounts, style, media library). `also`: the
// pages that belong to a section, to highlight it.
const nav = [
  { href: "/fauve", label: "Fauve", icon: ChatIcon, also: [] },
  { href: "/calendrier", label: "Calendrier", icon: CalendarIcon, also: ["/publications", "/grille"] },
  { href: "/resultats", label: "Résultats", icon: ChartIcon, also: [] },
  { href: "/reglages", label: "Réglages", icon: SlidersIcon, also: ["/style", "/mediatheque"] },
] as const;

type Variant = "sidebar" | "bar";

/** Navigation links with the current page highlighted. */
export function NavLinks({ variant }: { variant: Variant }) {
  return <NavList variant={variant} pathname={usePathname()} />;
}

/** Same links; `pathname` null renders them without highlight (prerendered fallback). */
export function NavList({ variant, pathname }: { variant: Variant; pathname: string | null }) {
  const isActive = (href: string) => {
    const item = nav.find((n) => n.href === href)!;
    return pathname !== null && [href, ...item.also].some((h) => pathname === h || pathname.startsWith(`${h}/`));
  };

  if (variant === "sidebar") {
    return nav.map(({ href, label, icon: Icon }) => {
      const active = isActive(href);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] ${
            active ? "bg-violet-soft font-bold text-violet" : "font-medium text-muted hover:text-ink"
          }`}
        >
          <Icon />
          {label}
        </Link>
      );
    });
  }

  return nav.map(({ href, label, icon: Icon }) => {
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
