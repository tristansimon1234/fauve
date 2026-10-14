import { Suspense } from "react";
import { NavLinks, NavList } from "./app-nav";
import { FauveDrawerProvider } from "./fauve-drawer";
import { Logo } from "./orb";

/**
 * Navigation chrome. The studio card (sidebar) and avatar (phone header) read the
 * session, so the layout passes them in as Server Components behind <Suspense>.
 * The current page highlight reads the URL, so it streams in too.
 */
export function AppShell({
  children,
  account,
  avatar,
}: {
  children: React.ReactNode;
  account: React.ReactNode;
  avatar: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-9 border-r border-line px-4 pt-7 pb-6 lg:flex">
        <div className="px-1.5">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          <Suspense fallback={<NavList variant="sidebar" pathname={null} />}>
            <NavLinks variant="sidebar" />
          </Suspense>
        </nav>
        <div className="mt-auto flex flex-col gap-3.5">{account}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
          <Logo size={30} />
          {avatar}
        </header>
        {/* Brigitte's side panel opens over any page, about what is on it. */}
        <FauveDrawerProvider>{children}</FauveDrawerProvider>
      </div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <Suspense fallback={<NavList variant="bar" pathname={null} />}>
          <NavLinks variant="bar" />
        </Suspense>
      </nav>
    </div>
  );
}
