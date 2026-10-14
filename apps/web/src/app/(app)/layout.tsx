import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { AvatarPlaceholder, HeaderAvatar, LiveUpdates, SidebarAccount } from "@/components/studio-account";

// The Fauve drawer opens on every page: its Server Actions (a chat turn, then the work
// it starts after the answer) run under the host page's route.
export const maxDuration = 300;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      account={
        <Suspense fallback={<div className="h-[140px] rounded-[14px] bg-soft" />}>
          <SidebarAccount />
        </Suspense>
      }
      avatar={
        <Suspense fallback={<AvatarPlaceholder />}>
          <HeaderAvatar />
        </Suspense>
      }
    >
      {children}
      <Suspense fallback={null}>
        <LiveUpdates />
      </Suspense>
    </AppShell>
  );
}
