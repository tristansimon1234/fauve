"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { imagesToShare } from "@/app/(app)/publications/[id]/review-actions";
import { DownloadIcon, ShareIcon } from "@/components/icons";
import type { PostImages } from "@/lib/post-images";

// A carousel or photo post published by hand (Tristan, « ok »): on a phone, « Partager » sends
// all its images at once to the share sheet (Instagram, or « Enregistrer les images » to make
// the carousel from the gallery when Instagram keeps only one); on a computer, « Télécharger
// les images », in order. Her caption is copied first: Instagram drops any text shared with files.
// The files are fetched as soon as the page opens, so the share happens within her touch (Safari).

const noChange = () => () => {};

/** A phone that shares image files (a computer's share sheet has no Instagram). */
function sharesImages(): boolean {
  try {
    if (!window.matchMedia("(pointer: coarse)").matches || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File([new Blob()], "1.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

const RETRY_MS = 10_000;

export function ShareImages({ postId, tone = "light" }: { postId: string; tone?: "light" | "dark" }) {
  const can = useSyncExternalStore(noChange, sharesImages, () => false);
  const [images, setImages] = useState<PostImages | null>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  // Its images, again while they are being redrawn (texts just changed).
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      imagesToShare(postId)
        .then((found) => {
          if (!live) return;
          setImages(found);
          if (found?.state === "rendering") timer = setTimeout(load, RETRY_MS);
        })
        .catch(() => live && setImages(null));
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [postId]);

  // On a phone, the files ready before her touch.
  useEffect(() => {
    if (!can || images?.state !== "ready") return;
    let live = true;
    Promise.all(
      images.items.map(async (item) => {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(String(res.status));
        return new File([await res.blob()], item.name, { type: item.video ? "video/mp4" : "image/jpeg" });
      }),
    )
      .then((list) => live && setFiles(list))
      .catch(() => live && setFiles(null));
    return () => {
      live = false;
    };
  }, [can, images]);

  if (!images || images.state === "none" || images.state === "failed") return null;
  const ready = images.state === "ready";
  const many = ready && images.items.length > 1;

  const copyCaption = () => {
    if (images.caption.trim()) navigator.clipboard?.writeText(images.caption).catch(() => {});
  };

  const share = async () => {
    if (!files?.length) return;
    copyCaption();
    setBusy(true);
    try {
      await navigator.share({ files });
      setLine(images.caption.trim() ? "Ta légende est copiée : colle-la au moment de publier." : null);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "AbortError") setLine("Le partage n’a pas marché. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!ready) return;
    copyCaption();
    setBusy(true);
    // One after the other: a browser refuses several downloads started at the same instant.
    for (const item of images.items) {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = item.name;
      document.body.append(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 450));
    }
    setBusy(false);
    setLine(images.caption.trim() ? "Ta légende est copiée aussi : colle-la au moment de publier." : null);
  };

  const button =
    tone === "dark"
      ? "flex w-full items-center justify-center gap-2 rounded-full border border-white/25 py-3.5 text-[15px] font-bold disabled:opacity-50"
      : "btn btn-secondary h-[50px] w-full text-[16px] font-extrabold disabled:opacity-50";
  const note = tone === "dark" ? "text-center text-[12.5px] leading-snug text-white/65" : "text-center text-[12.5px] leading-snug text-muted";

  return (
    <div className="flex flex-col gap-1.5">
      {can ? (
        <button type="button" onClick={share} disabled={!files || busy} className={button}>
          <ShareIcon size={18} />
          {!ready ? "Les images se refont…" : !files || busy ? "Un instant…" : "Partager sur Instagram"}
        </button>
      ) : (
        <button type="button" onClick={download} disabled={!ready || busy} className={button}>
          <DownloadIcon size={18} />
          {!ready ? "Les images se refont…" : busy ? "Un instant…" : many ? `Télécharger les ${images.items.length} images` : "Télécharger l’image"}
        </button>
      )}
      <p className={note}>
        {line ??
          (can
            ? many
              ? "Choisis Instagram. S’il ne garde qu’une photo : « Enregistrer les images », puis + › Publication et coche-les dans l’ordre."
              : "Choisis Instagram, ou « Enregistrer l’image » pour la publier depuis ta galerie."
            : "Sur ton téléphone, ce bouton les ouvre directement dans Instagram.")}
      </p>
    </div>
  );
}
