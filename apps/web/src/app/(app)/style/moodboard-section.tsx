"use client";

import { useId, useState } from "react";
import { MOODBOARD_MAX_ITEMS } from "@fauve/agent";
import { PlusIcon, XIcon } from "@/components/icons";
import { Orb } from "@/components/orb";
import { supabaseBrowser } from "@/lib/supabase/client";
import { saveMoodboard } from "./actions";
import {
  MOODBOARD_IMAGE_EDGE,
  MOODBOARD_NOTE_MAX,
  MOODBOARD_SOURCE_MAX_BYTES,
  type MoodboardItem,
  type MoodboardView,
} from "./style-options";
import { Section } from "./ui";

type State = { status: "idle" | "uploading" | "reading" } | { status: "ok" | "error"; message: string };

/** Resized to a JPEG in the browser: phone screenshots and photos become light, readable images. */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MOODBOARD_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.86));
}

const key = (items: MoodboardItem[]) => JSON.stringify(items.map((i) => [i.path, i.note.trim()]));

export function MoodboardSection({
  studioId,
  initial,
  onSaved,
  onUsePalette,
}: {
  studioId: string;
  initial: MoodboardView;
  onSaved: (version: number) => void;
  onUsePalette: (colors: string[]) => void;
}) {
  const id = useId();
  const [items, setItems] = useState(initial.items);
  const [savedKey, setSavedKey] = useState(key(initial.items));
  const [reading, setReading] = useState(initial.reading);
  const [palette, setPalette] = useState(initial.palette);
  const [state, setState] = useState<State>({ status: "idle" });
  const busy = state.status === "uploading" || state.status === "reading";
  const dirty = key(items) !== savedKey;
  const room = MOODBOARD_MAX_ITEMS - items.length;

  const add = async (files: File[]) => {
    const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!picked.length) return setState({ status: "error", message: "Choisis des images (JPEG, PNG, WebP…)." });
    if (picked.some((f) => f.size > MOODBOARD_SOURCE_MAX_BYTES)) return setState({ status: "error", message: "Une image dépasse 25 Mo." });
    setState({ status: "uploading" });
    const storage = supabaseBrowser().storage.from("media");
    const added: MoodboardItem[] = [];
    let failed = 0;
    for (const file of picked) {
      try {
        const blob = await toJpeg(file);
        const path = `${studioId}/brand/mood-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await storage.upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        added.push({ path, url: URL.createObjectURL(blob), note: "" });
      } catch {
        failed++;
      }
    }
    setItems((current) => [...current, ...added].slice(0, MOODBOARD_MAX_ITEMS));
    setState(
      failed
        ? { status: "error", message: `${failed} image${failed > 1 ? "s n’ont" : " n’a"} pas pu être ajoutée${failed > 1 ? "s" : ""} (format non lu ou connexion).` }
        : { status: "idle" },
    );
  };

  const read = async () => {
    const submitted = items.map((i) => ({ ...i, note: i.note.trim() }));
    setState({ status: "reading" });
    try {
      const result = await saveMoodboard(submitted.map((i) => ({ path: i.path, note: i.note || undefined })));
      if (result.status === "error") return setState(result);
      onSaved(result.version);
      setSavedKey(key(submitted));
      setReading(result.reading);
      setPalette(result.palette);
      setState(
        result.warning
          ? { status: "error", message: result.warning }
          : { status: "ok", message: submitted.length ? "Moodboard lu et enregistré." : "Moodboard retiré." },
      );
    } catch {
      setState({ status: "error", message: "L’enregistrement a échoué. Vérifie ta connexion et réessaie." });
    }
  };

  return (
    <Section
      id="style-moodboard"
      title="Moodboard"
      hint="Des images qui t’inspirent : captures de Reels, affiches, photos, marques que tu aimes. Ajoute une note pour dire ce qui te plaît. Simone en tire une direction artistique pour tes montages."
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-busy={busy}>
        {items.map((item, i) => (
          <li key={item.path} className="flex flex-col gap-1.5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] border border-line bg-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.note || `Inspiration ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Retirer l’inspiration ${i + 1}`}
                disabled={busy}
                onClick={() => setItems((current) => current.filter((x) => x.path !== item.path))}
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm disabled:opacity-50"
              >
                <XIcon size={16} />
              </button>
            </div>
            <label className="sr-only" htmlFor={`${id}-note-${i}`}>
              Ce que tu aimes dans l’inspiration {i + 1}
            </label>
            <input
              id={`${id}-note-${i}`}
              value={item.note}
              maxLength={MOODBOARD_NOTE_MAX}
              disabled={busy}
              placeholder="Ce que j’aime…"
              onChange={(e) => {
                const note = e.target.value;
                setItems((current) => current.map((x) => (x.path === item.path ? { ...x, note } : x)));
              }}
              className="h-9 rounded-full border border-line bg-soft px-3 text-[13px] outline-none focus:border-violet"
            />
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={id}
              className={`flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-line bg-soft px-3 text-center text-sm font-semibold text-muted transition-colors hover:border-violet hover:text-violet has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
            >
              <PlusIcon size={22} />
              {state.status === "uploading" ? "Ajout…" : items.length ? "Ajouter" : "Ajouter des images"}
              <span className="text-xs font-normal">{room} restante{room > 1 ? "s" : ""}</span>
              <input
                id={id}
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                className="sr-only"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length) add(files).catch(() => setState({ status: "error", message: "L’ajout a échoué. Réessaie." }));
                }}
              />
            </label>
          </li>
        )}
      </ul>

      {(items.length > 0 || dirty || "message" in state) && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => read()} disabled={busy || !dirty} className="btn btn-primary disabled:opacity-50">
            {state.status === "reading" ? "Simone regarde tes images…" : items.length || !dirty ? "Faire lire à Simone · 1 crédit" : "Enregistrer"}
          </button>
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`min-w-0 flex-1 text-sm font-semibold ${state.status === "error" ? "text-danger" : state.status === "ok" ? "text-success" : "text-muted"}`}
          >
            {"message" in state
              ? state.message
              : state.status === "reading"
                ? "Ça prend jusqu’à une minute."
                : dirty
                  ? "Moodboard modifié : fais-le lire à Simone pour qu’elle l’applique."
                  : ""}
          </p>
        </div>
      )}

      {reading && (
        <div className="flex flex-col gap-3 rounded-[16px] bg-soft p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <Orb size={28} still />
            <h3 className="text-[15px] font-bold">Ce que Simone en retient</h3>
          </div>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{reading}</p>
          {palette.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <ul className="flex gap-1.5" aria-label="Palette tirée du moodboard">
                {palette.map((c) => (
                  <li key={c} title={c} className="size-8 rounded-full border border-line" style={{ background: c }}>
                    <span className="sr-only">{c}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => onUsePalette(palette)} className="btn btn-secondary text-sm">
                Utiliser cette palette
              </button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
