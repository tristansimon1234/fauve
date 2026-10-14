"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { saveCustomFonts, type OwnFont } from "./actions";

// « Tes polices »: the studio's own font files (a licensed font, the one of its
// logo or website). Uploaded once, then usable by name everywhere: titles and
// texts of the Reels, text on photos, Fauve's layouts.

const MAX_BYTES = 8 * 1024 * 1024;
const familyFrom = (file: string) =>
  file
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+(regular|bold|light|medium|italic|book|roman|webfont)\b/gi, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

export function OwnFonts({
  studioId,
  initial,
  display,
  body,
  onUse,
}: {
  studioId: string;
  initial: OwnFont[];
  display: string | null;
  body: string | null;
  onUse: (change: { display_font?: string; body_font?: string }) => void;
}) {
  const [fonts, setFonts] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Each font drawn in itself.
  useEffect(() => {
    for (const f of fonts) {
      if ([...document.fonts].some((face) => face.family === f.family)) continue;
      new FontFace(f.family, `url("${f.url}")`)
        .load()
        .then((face) => document.fonts.add(face))
        .catch(() => {});
    }
  }, [fonts]);

  const save = (next: { family: string; path: string }[]) =>
    start(async () => {
      setError(null);
      const res = await saveCustomFonts(next).catch(() => ({ status: "error" as const, message: "Ce n’est pas enregistré. Réessaie." }));
      if (res.status === "ok") setFonts(res.fonts);
      else setError(res.message);
    });

  const upload = async (file: File) => {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["ttf", "otf", "woff", "woff2"].includes(ext)) return setError("Formats acceptés : .ttf, .otf, .woff, .woff2.");
    if (file.size > MAX_BYTES) return setError("Ce fichier dépasse 8 Mo.");
    const family = familyFrom(file.name) || "Ma police";
    const slug = `${family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "police"}-${Date.now()}`;
    const path = `${studioId}/fonts/${slug}.${ext}`;
    const { error: uploadError } = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type || "font/" + ext });
    if (uploadError) return setError("L’envoi a échoué. Réessaie.");
    save([...fonts.map(({ family, path }) => ({ family, path })), { family, path }]);
  };

  const chip = (on: boolean) => `h-8 rounded-full px-3 text-[12px] font-semibold ${on ? "bg-violet text-white" : "bg-white text-ink hover:text-violet"}`;
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-soft p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-bold">Tes polices</span>
        <span className="text-[13px] text-muted">Ta police à toi (celle de ton logo ou de ton site), en fichier .ttf, .otf ou .woff. Fauve l’utilise dans tes Reels et tes textes sur photo.</span>
      </div>
      {fonts.map((f) => (
        <div key={f.path} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-white p-3">
          <span className="min-w-0 flex-1 truncate text-[22px] leading-tight" style={{ fontFamily: `"${f.family}", sans-serif` }}>
            {f.family}
          </span>
          <button type="button" onClick={() => onUse({ display_font: f.family })} className={chip(display === f.family)}>
            Titres
          </button>
          <button type="button" onClick={() => onUse({ body_font: f.family })} className={chip(body === f.family)}>
            Textes
          </button>
          <button
            type="button"
            aria-label={`Retirer ${f.family}`}
            disabled={busy}
            onClick={() => save(fonts.filter((g) => g.path !== f.path).map(({ family, path }) => ({ family, path })))}
            className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-danger"
          >
            <TrashIcon size={15} />
          </button>
        </div>
      ))}
      {fonts.length < 6 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed border-line py-2.5 text-[14px] font-bold text-violet hover:border-violet/50 hover:bg-white disabled:opacity-50"
        >
          <PlusIcon size={16} />
          {busy ? "Envoi…" : "Ajouter une police"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
      <p className="text-[12px] text-muted">Utilise seulement une police que tu as le droit d’utiliser (achetée ou gratuite).</p>
      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
