import type { ReactNode } from "react";
import { Mascot } from "@/components/mascot";

/** « Modifier » in pieces, for « Ta publication », which places them where its own are. */
export type EditorParts = {
  /** The Reel live, its texts to touch and drag; null while it opens. */
  preview: ReactNode | null;
  /** Its scenes, to choose one; null while it opens. */
  strip: ReactNode | null;
  /** What is chosen (a text, a scene), or the line while it opens. */
  settings: ReactNode;
  /** « Annuler » / « Enregistrer », with the line that asks before losing changes. */
  actions: ReactNode;
};

/** « Modifier » while its code loads, laid out by the page like the editor once it is there. */
export function OpeningEditor({ onClose, layout }: { onClose: () => void; layout: (parts: EditorParts) => ReactNode }) {
  return layout(openingParts(onClose));
}

/** While « Modifier » opens (its code, then the montage): the line, and a way back. */
export function openingParts(onClose: () => void, error?: string | null): EditorParts {
  return {
    preview: null,
    strip: null,
    settings: (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Mascot size={56} mood={error ? "sad" : "thinking"} />
        <p role={error ? "alert" : "status"} className="text-[15px] leading-snug font-semibold text-muted">
          {error ?? "J’ouvre ton montage…"}
        </p>
      </div>
    ),
    actions: (
      <button type="button" onClick={() => onClose()} className="btn btn-secondary h-11 w-full text-[15px]">
        {error ? "Revenir" : "Fermer"}
      </button>
    ),
  };
}
