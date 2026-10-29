"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// « Partager » on a phone (Tristan, on how CapCut posts to Instagram: « assez d'accord »): the
// phone's own share sheet with the video, as CapCut does it. She picks Instagram (or TikTok, or
// « Enregistrer la vidéo »), and Instagram opens with her Reel ready, where she can add a trending
// sound too. No Meta review needed: nothing is published by us. Her caption is copied first,
// since Instagram drops any text shared with a file. A computer has no share sheet with
// Instagram in it: « Télécharger » stays there.

export type VideoShare = {
  /** This device shares video files (a phone). */
  can: boolean;
  busy: boolean;
  /** The video fetched, but the touch went stale while it came (Safari): the next touch shares at once. */
  waiting: boolean;
  share: (caption: string) => Promise<"shared" | "cancelled" | "again" | "failed">;
};

const fileName = (title: string) => `${title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "reel"}.mp4`;

const noChange = () => () => {};

/** A phone that shares video files (on a computer, its share sheet has no Instagram). */
function sharesFiles(): boolean {
  try {
    if (!window.matchMedia("(pointer: coarse)").matches || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File([new Blob()], "reel.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

export function useVideoShare(url: string | null, title: string): VideoShare {
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const file = useRef<{ url: string; file: File } | null>(null);

  const can = useSyncExternalStore(noChange, sharesFiles, () => false);

  const share: VideoShare["share"] = async (caption) => {
    if (!url) return "failed";
    // Within her touch: the clipboard asks for it.
    if (caption.trim()) navigator.clipboard?.writeText(caption).catch(() => {});
    setBusy(true);
    try {
      if (file.current?.url !== url) {
        const res = await fetch(url);
        if (!res.ok) return "failed";
        file.current = { url, file: new File([await res.blob()], fileName(title), { type: "video/mp4" }) };
      }
      await navigator.share({ files: [file.current.file], title });
      setWaiting(false);
      return "shared";
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "AbortError") return "cancelled";
      // The video took longer than her touch lasts: it is here now, one more touch shares it.
      if (name === "NotAllowedError" && file.current?.url === url) {
        setWaiting(true);
        return "again";
      }
      return "failed";
    } finally {
      setBusy(false);
    }
  };

  return { can, busy, waiting, share };
}

/** The line shown after her touch. */
export function shareMessage(result: Awaited<ReturnType<VideoShare["share"]>>, caption: string): string | null {
  if (result === "shared") return caption.trim() ? "Ta légende est copiée : colle-la au moment de publier." : null;
  if (result === "again") return "Ta vidéo est prête : touche le bouton encore une fois.";
  if (result === "failed") return "Le partage n’a pas marché. Télécharge la vidéo à la place.";
  return null;
}
