"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChartIcon, ChatIcon, FolderIcon, ImageIcon, SlidersIcon } from "./icons";

const nav = [
  { href: "/fauve", label: "Fauve", icon: ChatIcon },
  { href: "/calendrier", label: "Calendrier", icon: CalendarIcon },
  { href: "/publications", label: "Publications", icon: ImageIcon },
  { href: "/mediatheque", label: "Médiathèque", icon: FolderIcon },
  { href: "/resultats", label: "Résultats", icon: ChartIcon },
  { href: "/reglages", label: "Réglages", icon: SlidersIcon },
] as const;

// Shown in the bottom bar on phones.
const mobileNav = nav.filter((item) => item.href !== "/mediatheque" && item.href !== "/reglages");

type Variant = "sidebar" | "bar";

/** Navigation links with the current page highlighted. */
export function NavLinks({ variant }: { variant: Variant }) {
  return <NavList variant={variant} pathname={usePathname()} />;
}

/** Same links; `pathname` null renders them without highlight (prerendered fallback). */
export function NavList({ variant, pathname }: { variant: Variant; pathname: string | null }) {
  const isActive = (href: string) => pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));

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

  return mobileNav.map(({ href, label, icon: Icon }) => {
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
