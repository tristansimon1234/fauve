"use client";

import { useState, type ReactNode } from "react";
import { GridIcon, ReelIcon } from "@/components/icons";

// Instagram's views of a profile, icons only as in the app: every post in the grid, or the
// Reels alone; `extra` is a tab drawn for the likeness (her tagged posts), never opened.

export function GridTabs({ all, reels, extra }: { all: ReactNode; reels: ReactNode; extra?: ReactNode }) {
  const [tab, setTab] = useState<"all" | "reels">("all");
  const tabs = [
    { key: "all" as const, label: "Publications", Icon: GridIcon },
    { key: "reels" as const, label: "Reels", Icon: ReelIcon },
  ];
  return (
    <>
      <div role="tablist" aria-label="Vue de la grille" className={`grid ${extra ? "grid-cols-3" : "grid-cols-2"}`}>
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-label={label}
            title={label}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center py-2.5 transition-colors ${
              tab === key ? "text-[#000] shadow-[inset_0_-1px_0_#000]" : "text-[#737373] hover:text-[#000]"
            }`}
          >
            <Icon size={24} />
          </button>
        ))}
        {extra && (
          <span aria-hidden="true" className="flex items-center justify-center py-2.5 text-[#737373]">
            {extra}
          </span>
        )}
      </div>
      <div role="tabpanel" className="pt-px">
        {tab === "all" ? all : reels}
      </div>
    </>
  );
}
