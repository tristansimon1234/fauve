"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PlayIcon, UploadIcon } from "@/components/icons";
import { libraryForPicker, type LibraryItem } from "../new-post-actions";

// The library in the chat (reply_with pick_media): Fauve asks which photos or
// videos to use, the manager ticks them (in order) and sends; new files can be
// added from the device too. The answer carries the media ids Fauve needs.

const labels = { photo: "photos", video: "vidéos", any: "photos et vidéos" } as const;

export function MediaPickCard({
  kind,
  onPick,
  onFiles,
  className = "",
}: {
  kind: keyof typeof labels;
  onPick: (text: string) => void;
  onFiles: (files: FileList | File[]) => void;
  className?: string;
}) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    libraryForPicker(kind)
      .then((list) => live && setItems(list))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [kind]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 10 ? c : [...c, id]));
  const send = () => {
    const n = chosen.length;
    onPick(`Je prends ${n === 1 ? "celle-ci" : `ces ${n}`} dans la médiathèque, dans cet ordre (media_id : ${chosen.join(", ")}).`);
  };

  return (
    <div className={`flex w-full max-w-[420px] flex-col gap-2.5 rounded-[18px] border border-line bg-white p-3 ${className}`}>
      <span className="text-[13px] font-bold">Tes {labels[kind]}</span>
      {items === null ? (
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="aspect-square animate-pulse rounded-lg bg-soft" aria-hidden />
          ))}
        </div>
      ) : items.length ? (
        <ul className="grid max-h-[300px] grid-cols-4 gap-1.5 overflow-y-auto">
          {items.map((m) => {
            const at = chosen.indexOf(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={at >= 0}
                  aria-label={`${m.video ? "Vidéo" : "Photo"} du ${new Date(m.at).toLocaleDateString("fr-FR")}`}
                  onClick={() => toggle(m.id)}
                  className={`relative block aspect-square w-full overflow-hidden rounded-lg bg-ink ${at >= 0 ? "ring-2 ring-violet ring-offset-2" : "hover:opacity-90"}`}
                >
                  {m.video ? (
                    <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" loading="lazy" className="size-full object-cover" />
                  )}
                  {m.video && (
                    <span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white">
                      <PlayIcon size={10} />
                    </span>
                  )}
                  {at >= 0 && <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-violet text-[11px] font-bold text-white">{at + 1}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Rien dans ta médiathèque pour l’instant.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!chosen.length} onClick={send} className="btn btn-primary h-9 px-3.5 text-[13px] disabled:opacity-40">
          <CheckIcon size={15} />
          {chosen.length ? `Utiliser ${chosen.length > 1 ? `ces ${chosen.length}` : "celle-ci"}` : "Choisis-en"}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-violet hover:bg-violet-soft">
          <UploadIcon size={15} />
          Ajouter depuis ton appareil
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={kind === "photo" ? "image/*" : kind === "video" ? "video/*" : "image/*,video/*"}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
