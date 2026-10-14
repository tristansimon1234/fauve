"use client";

import { useState, type ReactNode } from "react";
import { GridIcon, ReelIcon } from "@/components/icons";

// Instagram's two views of a profile: every post in the grid, or the Reels alone.

export function GridTabs({ all, reels }: { all: ReactNode; reels: ReactNode }) {
  const [tab, setTab] = useState<"all" | "reels">("all");
  const tabs = [
    { key: "all" as const, label: "Publications", Icon: GridIcon },
    { key: "reels" as const, label: "Reels", Icon: ReelIcon },
  ];
  return (
    <>
      <div role="tablist" aria-label="Vue de la grille" className="grid grid-cols-2 border-t border-line">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            title={label}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold transition-colors ${
              tab === key ? "border-b-2 border-ink text-ink" : "border-b-2 border-transparent text-muted hover:text-ink"
            }`}
          >
            <Icon size={20} />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "all" ? all : reels}</div>
    </>
  );
}
