"use client";

import { useState, type ReactNode } from "react";
import { InstagramIcon, TikTokIcon } from "@/components/icons";

// The page beside its profile (Tristan: « tous les trucs ici mets-les plutôt sur le côté »):
// on a computer, the title, the button, the network and its link line in a column on the left,
// the profile on the right; on a phone, the same column above it. Instagram or TikTok:
// each profile as its followers see it.

export type ProfileView = { key: "instagram" | "tiktok"; hint: ReactNode; profile: ReactNode };

export function GridLayout({ aside, views }: { aside: ReactNode; views: ProfileView[] }) {
  const [platform, setPlatform] = useState<ProfileView["key"]>(views[0]?.key ?? "instagram");
  const shown = views.find((v) => v.key === platform) ?? views[0];
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
      <aside className="flex flex-col gap-5 lg:sticky lg:top-9 lg:w-[300px] lg:shrink-0">
        {aside}
        {views.length > 1 && (
          <div role="tablist" aria-label="Réseau" className="flex gap-1.5 self-start rounded-full bg-soft p-1">
            {views.map(({ key }) => {
              const Icon = key === "tiktok" ? TikTokIcon : InstagramIcon;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={platform === key}
                  onClick={() => setPlatform(key)}
                  className={`flex h-10 items-center gap-2 rounded-full px-4.5 text-sm font-bold transition-colors ${platform === key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                >
                  <Icon size={16} />
                  {key === "tiktok" ? "TikTok" : "Instagram"}
                </button>
              );
            })}
          </div>
        )}
        {shown?.hint}
      </aside>
      <div role="tabpanel" className="min-w-0 flex-1">
        {shown?.profile}
      </div>
    </div>
  );
}
