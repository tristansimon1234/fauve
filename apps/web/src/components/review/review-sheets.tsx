"use client";

import { useEffect } from "react";
import { DownloadIcon, InstagramIcon, XIcon } from "@/components/icons";
import type { ReviewData } from "@/lib/review";
import { DateView } from "./change-panel";

// What « Prévoir » and « Publier » open on a Reel's page, the same in the app and on the page
// opened from WhatsApp: when Edith reminds her to post it, and, before Instagram is connected,
// how she posts it herself (her phone's share sheet, else the video to save) and connecting it, for her results.

export type ReviewSheet = "date" | "instagram";

/** Nothing goes out before her Instagram is connected: « Publier » first offers to connect it. */
export const needsInstagram = (data: ReviewData) => !data.instagram && (!data.platforms.length || data.platforms.includes("instagram"));

export function ReviewSheets({
  sheet,
  data,
  onClose,
  onPlanned,
  share,
}: {
  sheet: ReviewSheet | null;
  data: ReviewData;
  onClose: () => void;
  /** The moment changed: the line to show her (empty when nothing changed). */
  onPlanned: (message: string) => void;
  /** On a phone, the share sheet with her video (share-video.ts). */
  share?: { can: boolean; busy: boolean; waiting: boolean; onShare: () => void };
}) {
  if (sheet === "date") {
    return (
      <Sheet title="Quand te faire signe ?" hint="Edith te rappelle de le poster à ce moment-là, sur WhatsApp et dans l’app." onClose={onClose}>
        <DateView data={data} onDone={onPlanned} />
      </Sheet>
    );
  }
  if (sheet === "instagram") {
    // A phone shares it straight away (« Publier » opens its share sheet): this sheet is a computer's,
    // or a phone whose browser cannot share a video. She posts it herself; connecting is for her results.
    return (
      <Sheet
        title="Publie-le toi-même"
        hint="Ouvre ce Reel sur ton téléphone et touche « Publier » : Instagram s’ouvre avec ta vidéo prête, et tu peux y ajouter un son tendance. Ou télécharge la vidéo."
        onClose={onClose}
      >
        {share?.can ? (
          <button type="button" onClick={share.onShare} disabled={share.busy} className="btn btn-primary w-full disabled:opacity-60">
            <InstagramIcon size={18} />
            {share.busy ? "Un instant…" : share.waiting ? "Partager maintenant" : "Ouvrir dans Instagram"}
          </button>
        ) : (
          data.downloadUrl && (
            <a href={data.downloadUrl} download className="btn btn-primary w-full">
              <DownloadIcon size={18} />
              Télécharger la vidéo
            </a>
          )
        )}
        {data.connect && (
          <a href="/api/instagram/connect" className="btn btn-secondary w-full">
            <InstagramIcon size={18} />
            Relier Instagram pour suivre tes résultats
          </a>
        )}
      </Sheet>
    );
  }
  return null;
}

/** A small sheet over the page: from the bottom of a phone, in the middle of a computer's screen. */
export function Sheet({ title, hint, onClose, children }: { title: string; hint: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center text-ink sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={onClose} className="fauve-fade absolute inset-0 bg-ink/35" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fauve-enter relative flex max-h-[88dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-[26px] bg-white px-5 pt-4 pb-[max(1.4rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(28,21,48,0.14)] sm:max-w-[440px] sm:rounded-[22px] sm:pb-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-[18px] font-extrabold">{title}</h2>
            <p className="text-[13.5px] leading-snug text-muted">{hint}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft text-muted">
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
