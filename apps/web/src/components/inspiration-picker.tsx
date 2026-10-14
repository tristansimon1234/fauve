"use client";

import { useEffect, useRef, useState } from "react";
import { addInspiration, getInspirations, inspirationsRead } from "@/app/(app)/inspiration-actions";
import type { InspirationItem } from "@/lib/inspirations";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BulbIcon, CheckIcon, PlusIcon } from "./icons";

// « Inspiration »: the Reels the manager likes (shared on Instagram or added
// here), one of which this montage follows. Adding one: a video (or a
// screenshot) she likes; Fauve watches it in a minute and keeps only her notes.

const MAX_BYTES = 50 * 1024 * 1024;

export function InspirationPicker({
  value,
  onChange,
  initial = null,
}: {
  value: string | null;
  onChange: (item: InspirationItem | null) => void;
  /** Already loaded by the caller (no second fetch). */
  initial?: { studioId: string; items: InspirationItem[] } | null;
}) {
  const [data, setData] = useState<{ studioId: string; items: InspirationItem[] } | null>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial) return;
    let live = true;
    getInspirations()
      .then((d) => live && setData(d))
      .catch(() => live && setData({ studioId: "", items: [] }));
    return () => {
      live = false;
    };
  }, [initial]);

  // While Fauve watches a new one, check every few seconds.
  const reading = data?.items.filter((i) => i.reading).map((i) => i.id) ?? [];
  const readingKey = reading.join(",");
  useEffect(() => {
    if (!readingKey) return;
    const timer = setInterval(() => {
      inspirationsRead(readingKey.split(","))
        .then((fresh) => setData((d) => (d ? { ...d, items: d.items.map((i) => fresh.find((f) => f.id === i.id) ?? i) } : d)))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [readingKey]);

  const upload = async (file: File) => {
    if (!data?.studioId) return;
    setError(null);
    if (!/^(video|image)\//.test(file.type)) return setError("Ajoute une vidéo ou une capture d’écran.");
    if (file.size > MAX_BYTES) return setError("Cette vidéo dépasse 50 Mo.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (file.type.startsWith("video/") ? "mp4" : "jpg");
      const path = `${data.studioId}/inspirations/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 60);
      const item = await addInspiration({ path, mime: file.type, title });
      if (!item) throw new Error("not added");
      setData((d) => (d ? { ...d, items: [item, ...d.items] } : d));
      onChange(item);
    } catch {
      setError("L’ajout a échoué. Réessaie.");
    } finally {
      setUploading(false);
    }
  };

  const card = (on: boolean) =>
    `fauve-press relative flex min-h-[72px] w-[148px] shrink-0 flex-col gap-1 rounded-[14px] border p-2.5 text-left transition-colors ${on ? "border-violet bg-violet-soft" : "border-line bg-white hover:border-violet/40"}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="radiogroup" aria-label="Inspiration">
        <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={card(value === null)}>
          <span className="pr-5 text-[13px] font-bold">Simone choisit</span>
          <span className="text-[11px] leading-snug text-muted">D’après ton style et ce qui marche</span>
          {value === null && <Tick />}
        </button>
        {data === null && <span className="h-[72px] w-[148px] shrink-0 animate-pulse rounded-[14px] bg-soft" aria-hidden />}
        {data?.items.map((item) => {
          const on = value === item.id;
          return (
            <button key={item.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(item)} title={item.summary ?? item.title} className={card(on)}>
              <span className="flex items-center gap-1 pr-5 text-[13px] font-bold">
                <BulbIcon size={13} />
                <span className="truncate">{item.title}</span>
              </span>
              <span className="line-clamp-2 text-[11px] leading-snug text-muted">{item.reading ? "Simone la regarde…" : (item.summary ?? "Partagée sur Instagram")}</span>
              {on && <Tick />}
            </button>
          );
        })}
        <button
          type="button"
          disabled={uploading || !data?.studioId}
          onClick={() => fileRef.current?.click()}
          className="flex min-h-[72px] w-[148px] shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-line p-2.5 text-center text-violet hover:border-violet/50 hover:bg-violet-soft disabled:opacity-50"
        >
          <PlusIcon size={16} />
          <span className="text-[12px] font-bold leading-tight">{uploading ? "Envoi…" : "Ajouter un Reel qui te plaît"}</span>
        </button>
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
      {error ? (
        <p role="alert" className="text-[12px] font-semibold text-danger">
          {error}
        </p>
      ) : (
        <p className="text-[12px] leading-snug text-muted">Enregistre un Reel qui te plaît (ou une capture) et ajoute-le : Simone en reprend le rythme et l’accroche, sans le copier.</p>
      )}
    </div>
  );
}

function Tick() {
  return (
    <span className="absolute top-2 right-2 flex size-4.5 items-center justify-center rounded-full bg-violet text-white">
      <CheckIcon size={11} />
    </span>
  );
}
