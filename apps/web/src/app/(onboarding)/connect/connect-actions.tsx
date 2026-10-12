"use client";

import Link from "next/link";
import { useState } from "react";
import { InstagramIcon } from "@/components/icons";

// TODO(connect): open the aggregator's (Ayrshare) account-linking flow for this studio.
export function ConnectActions() {
  const [tiktok, setTiktok] = useState(true);
  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">Ajouter TikTok aussi</span>
          <span className="text-[13px] text-muted">Mila publiera tes Reels sur les deux</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={tiktok}
          aria-label="Ajouter TikTok"
          onClick={() => setTiktok((v) => !v)}
          className={`flex h-[30px] w-[52px] shrink-0 rounded-full p-1 transition-colors ${tiktok ? "bg-violet" : "bg-track"}`}
        >
          <span
            className={`size-[22px] rounded-full bg-white transition-transform ${tiktok ? "translate-x-[22px]" : ""}`}
          />
        </button>
      </div>
      <p className="text-[13px] leading-normal text-muted">
        Il faut un compte Instagram professionnel.{" "}
        <a
          href="https://help.instagram.com/502981923235522"
          className="font-bold text-violet"
          target="_blank"
          rel="noreferrer"
        >
          Comment passer en compte pro ?
        </a>
      </p>
      <div className="mt-auto -mx-6 border-t border-line px-6 pt-3.5 pb-7.5">
        <Link
          href="/pret"
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white"
        >
          <InstagramIcon />
          Continuer avec Instagram
        </Link>
      </div>
    </>
  );
}
