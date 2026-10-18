"use client";

import { useRef, useState, useTransition } from "react";
import { BulbIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addInspiration, followInspiration, removeInspiration } from "../inspiration-actions";
import { Section } from "./ui";

export type Inspiration = {
  id: string;
  title: string | null;
  url: string | null;
  analysis: string | null;
  at: string;
  reading?: boolean;
  /** Its style was read (« Steal »): her Reels can follow it. */
  styled?: boolean;
  /** Her Reels follow its style. */
  followed?: boolean;
};

const MAX_BYTES = 50 * 1024 * 1024;

/** Reels the manager likes (shared with Fauve on Instagram, or added here), and what Fauve takes from them. */
export function InspirationsSection({ items: initial, fauveHandle, studioId }: { items: Inspiration[]; fauveHandle: string | null; studioId: string }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!/^(video|image)\//.test(file.type)) return setError("Ajoute une vidéo ou une capture d’écran.");
    if (file.size > MAX_BYTES) return setError("Cette vidéo dépasse 50 Mo.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (file.type.startsWith("video/") ? "mp4" : "jpg");
      const path = `${studioId}/inspirations/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const item = await addInspiration({ path, mime: file.type, title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 60) });
      if (!item) throw new Error("not added");
      setItems((list) => [{ id: item.id, title: item.title, url: null, analysis: null, at: new Date().toISOString(), reading: true }, ...list]);
    } catch {
      setError("L’ajout a échoué. Réessaie.");
    } finally {
      setUploading(false);
    }
  };

  const remove = (id: string) =>
    start(async () => {
      const before = items;
      setItems((list) => list.filter((i) => i.id !== id));
      if (!(await removeInspiration(id).catch(() => false))) setItems(before);
    });

  // One style followed at a time: following one stops the other.
  const follow = (id: string, on: boolean) =>
    start(async () => {
      const before = items;
      setError(null);
      setItems((list) => list.map((i) => ({ ...i, followed: on ? i.id === id : false })));
      if (!(await followInspiration(on ? id : null).catch(() => false))) {
        setItems(before);
        setError("Le changement n’a pas abouti. Réessaie.");
      }
    });

  return (
    <Section
      id="style-inspirations"
      title="Tes inspirations"
      hint={`Des Reels qui te plaisent : Simone en mesure le rythme et en lit la forme, les textes et la lumière, sans jamais copier leurs images ni leurs mots. Ajoute-les ici${fauveHandle ? `, partage-les à @${fauveHandle} sur Instagram` : ""} ou envoie leur lien à Simone ; « Suivre ce style » et tes prochains Reels le reprennent, avec tes couleurs et tes polices.`}
    >
      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
                <BulbIcon size={16} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-semibold">{item.title || "Reel partagé"}</span>
                <span className="text-[13px] leading-relaxed text-muted">
                  {item.analysis ?? (item.reading ? "Simone la regarde, sa lecture arrive dans une minute." : "Pas encore lue.")}
                </span>
                {item.styled &&
                  (item.followed ? (
                    <span className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-[12px] font-bold text-violet">
                        <CheckIcon size={13} />
                        Tes Reels suivent ce style
                      </span>
                      <button type="button" onClick={() => follow(item.id, false)} className="text-[12px] font-semibold text-muted underline-offset-2 hover:underline">
                        Ne plus le suivre
                      </button>
                    </span>
                  ) : (
                    <span className="pt-1">
                      <button
                        type="button"
                        onClick={() => follow(item.id, true)}
                        className="rounded-full border-[1.5px] border-violet/40 px-3 py-1 text-[12px] font-bold text-violet hover:bg-violet-soft"
                      >
                        Suivre ce style
                      </button>
                    </span>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Retirer ${item.title || "cette inspiration"}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-danger"
              >
                <TrashIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-line py-3 text-[14px] font-bold text-violet hover:border-violet/50 hover:bg-violet-soft disabled:opacity-50"
        >
          <PlusIcon size={17} />
          {uploading ? "Envoi…" : "Ajouter un Reel qui te plaît"}
        </button>
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </Section>
  );
}
