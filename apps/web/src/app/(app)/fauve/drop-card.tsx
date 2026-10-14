"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";

// The drop zone Fauve puts under her message when she asks for files (reply_with
// upload): drag them in or pick them, they join the message being written.

const labels = {
  video: { title: "Dépose tes vidéos ici", accept: "video/*" },
  photo: { title: "Dépose tes photos ici", accept: "image/*" },
  any: { title: "Dépose tes photos et vidéos ici", accept: "image/*,video/*" },
} as const;

export function DropCard({ kind, onFiles, className = "" }: { kind: keyof typeof labels; onFiles: (files: FileList | File[]) => void; className?: string }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { title, accept } = labels[kind];
  return (
    <div className={`w-full max-w-[340px] ${className}`}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`fauve-press flex w-full flex-col items-center gap-1.5 rounded-[18px] border-[1.5px] border-dashed px-4 py-5 text-center transition-colors ${
          over ? "border-violet bg-violet-soft" : "border-lilac bg-white hover:border-violet hover:bg-violet-tint"
        }`}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-violet-soft text-violet">
          <UploadIcon size={20} />
        </span>
        <span className="text-[14px] font-bold text-ink">{title}</span>
        <span className="text-[12px] text-muted">ou clique pour les choisir · pleine qualité, 50 Mo max par fichier</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
