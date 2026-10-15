"use client";

import { useState, type ReactNode } from "react";
import { InstagramIcon, TikTokIcon } from "@/components/icons";

// Instagram or TikTok: each profile as its followers see it.

export function PlatformSwitch({ instagram, tiktok }: { instagram: ReactNode; tiktok: ReactNode }) {
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const options = [
    { key: "instagram" as const, label: "Instagram", Icon: InstagramIcon },
    { key: "tiktok" as const, label: "TikTok", Icon: TikTokIcon },
  ];
  return (
    <>
      <div role="tablist" aria-label="Réseau" className="mx-auto flex gap-1.5 rounded-full bg-soft p-1">
        {options.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={platform === key}
            onClick={() => setPlatform(key)}
            className={`flex h-10 items-center gap-2 rounded-full px-4.5 text-sm font-bold transition-colors ${platform === key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-6">
        {platform === "instagram" ? instagram : tiktok}
      </div>
    </>
  );
}
