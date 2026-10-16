"use client";

import { useState } from "react";
import { PlayIcon, XIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Attachment } from "./chat-actions";

// Photos and videos added to a chat with Fauve (the Fauve page and the side
// panel): uploaded to Storage as soon as they are picked, in full quality, and
// sent with the next message.

export type DraftFile = { id: string; file: File; preview: string; video: boolean; status: "uploading" | "ready" | "error"; path?: string };

/** Files sent at once (a Reel takes up to 20 clips and photos; a carousel 10, Instagram's limit). */
export const MAX_FILES = 20;
// Supabase's default per-file limit; WhatsApp-quality phone clips fit well under it.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function useChatUploads(studioId: string | null, onError: (message: string) => void) {
  const [files, setFiles] = useState<DraftFile[]>([]);

  /** Adds and starts sending the files; returns the ids of those kept. */
  const addFiles = (list: FileList | File[]): string[] => {
    if (!studioId) return [];
    const picked = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!picked.length) {
      onError("Ajoute des photos ou des vidéos.");
      return [];
    }
    if (picked.some((f) => f.size > MAX_FILE_BYTES)) onError("Un fichier dépasse 50 Mo : envoie-le plutôt sur WhatsApp en tant que document.");
    const added = picked
      .filter((f) => f.size <= MAX_FILE_BYTES)
      .slice(0, MAX_FILES - files.length)
      .map((file): DraftFile => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        video: file.type.startsWith("video/"),
        status: "uploading",
      }));
    if (!added.length) return [];
    setFiles((current) => [...current, ...added]);
    const storage = supabaseBrowser().storage.from("media");
    for (const draft of added) {
      const ext = draft.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (draft.video ? "mp4" : "jpg");
      const path = `${studioId}/chat/${draft.id}.${ext}`;
      storage
        .upload(path, draft.file, { contentType: draft.file.type })
        .then(({ error }) => setFiles((current) => current.map((f) => (f.id === draft.id ? { ...f, status: error ? "error" : "ready", path } : f))));
    }
    return added.map((d) => d.id);
  };

  const removeFile = (id: string) =>
    setFiles((current) => {
      const gone = current.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((f) => f.id !== id);
    });

  const ready = files.filter((f) => f.status === "ready" && f.path);
  return {
    files,
    ready,
    uploading: files.some((f) => f.status === "uploading"),
    attachments: (): Attachment[] => ready.map((f) => ({ path: f.path!, mime: f.file.type, size: f.file.size })),
    addFiles,
    removeFile,
    clear: () => setFiles([]),
  };
}

/** Thumbnails of the files waiting to be sent, each with its upload state and a remove button. */
export function FileStrip({ files, onRemove }: { files: DraftFile[]; onRemove: (id: string) => void }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 px-2" aria-label="Fichiers à envoyer">
      {files.map((f) => (
        <li key={f.id} className="fauve-pop relative size-16 overflow-hidden rounded-[12px] border border-line bg-soft">
          {f.video ? (
            <video src={`${f.preview}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.preview} alt="" className="size-full object-cover" />
          )}
          {f.video && <PlayIcon size={12} className="absolute bottom-1 left-1 text-white drop-shadow" />}
          {f.status !== "ready" && (
            <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${f.status === "error" ? "bg-peach/90 text-danger" : "bg-white/70 text-muted"}`}>
              {f.status === "error" ? "Échec" : "Envoi…"}
            </span>
          )}
          <button
            type="button"
            aria-label="Retirer"
            onClick={() => onRemove(f.id)}
            className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-ink/70 text-white"
          >
            <XIcon size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}
