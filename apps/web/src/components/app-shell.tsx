"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { demoStudio } from "@/lib/demo";
import {
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  FolderIcon,
  ImageIcon,
  InstagramIcon,
  SlidersIcon,
  TikTokIcon,
} from "./icons";
import { Logo } from "./orb";

const nav = [
  { href: "/mila", label: "Mila", icon: ChatIcon },
  { href: "/calendrier", label: "Calendrier", icon: CalendarIcon },
  { href: "/publications", label: "Publications", icon: ImageIcon },
  { href: "/mediatheque", label: "Médiathèque", icon: FolderIcon },
  { href: "/resultats", label: "Résultats", icon: ChartIcon },
  { href: "/reglages", label: "Réglages", icon: SlidersIcon },
] as const;

// Shown in the bottom bar on phones.
const mobileNav = nav.filter((item) => item.href !== "/mediatheque" && item.href !== "/reglages");

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-9 border-r border-line px-4 pt-7 pb-6 lg:flex">
        <div className="px-1.5">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {nav.map(({ href, label, icon: Icon }) => {
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
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3.5">
          <div className="flex flex-col gap-2 rounded-[14px] bg-soft p-3.5">
            <span className="text-xs font-bold tracking-[.06em] text-muted">COMPTES CONNECTÉS</span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <InstagramIcon size={18} className="text-violet" />@{demoStudio.instagram}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <TikTokIcon size={18} className="text-violet" />@{demoStudio.tiktok}
            </span>
          </div>
          <div className="flex items-center gap-3 px-1.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peach text-sm font-extrabold text-peach-ink">
              {demoStudio.initials}
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">{demoStudio.name}</span>
              <span className="text-[13px] text-muted">{demoStudio.manager} · Gérante</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <Logo size={30} />
          <span className="flex size-9 items-center justify-center rounded-full bg-peach text-xs font-extrabold text-peach-ink">
            {demoStudio.initials}
          </span>
        </header>
        {children}
      </div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {mobileNav.map(({ href, label, icon: Icon }) => {
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
        })}
      </nav>
    </div>
  );
}
