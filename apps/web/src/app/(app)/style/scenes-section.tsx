"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { archiveMotionTemplate } from "./actions";
import { Section } from "./ui";

export type SceneTemplate = { id: string; name: string; description: string; uses: number };

/** The studio's library of animated scenes, reused by Fauve with new texts. */
export function ScenesSection({ initial }: { initial: SceneTemplate[] }) {
  const [scenes, setScenes] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    const previous = scenes;
    setScenes((list) => list.filter((s) => s.id !== id));
    setError(null);
    const result = await archiveMotionTemplate(id).catch(() => ({ status: "error" as const, message: "La scène n’a pas pu être retirée." }));
    if (result.status === "error") {
      setScenes(previous);
      setError(result.message);
    }
  };

  return (
    <Section
      id="style-scenes"
      title="Tes scènes animées"
      hint="Chaque scène animée créée pour un de tes Reels est gardée ici. Fauve la réutilise avec d’autres textes : c’est plus rapide, et gratuit."
    >
      {scenes.length === 0 ? (
        <p className="text-sm text-muted">Pas encore de scène : la première arrivera avec ton prochain montage animé.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {scenes.map((scene) => (
            <li key={scene.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{scene.name}</span>
                <span className="line-clamp-2 text-[13px] text-muted">{scene.description}</span>
                <span className="text-xs font-semibold text-muted">
                  Utilisée {scene.uses} fois
                </span>
              </div>
              <button
                type="button"
                aria-label={`Retirer la scène ${scene.name}`}
                title="Retirer"
                onClick={() => remove(scene.id)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-danger"
              >
                <TrashIcon size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </Section>
  );
}
