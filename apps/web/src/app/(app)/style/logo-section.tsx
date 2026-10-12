"use client";

import { useId, useState } from "react";
import { TrashIcon, UploadIcon } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { saveLogo } from "./actions";
import { LOGO_MAX_BYTES, LOGO_TYPES, type Logo } from "./style-options";
import { Section } from "./ui";

type State = { status: "idle" | "busy" } | { status: "ok" | "error"; message: string };

const ACCEPT = Object.keys(LOGO_TYPES).join(",");
const EXTENSIONS: Record<string, string> = { png: "png", svg: "svg", webp: "webp", jpg: "jpg", jpeg: "jpg" };

/** Extension from the MIME type, or from the file name when the browser gives no type. */
function extensionOf(file: File): string | null {
  if (file.type) return LOGO_TYPES[file.type] ?? null;
  return EXTENSIONS[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export function LogoSection({
  studioId,
  studioName,
  logo,
  onSaved,
}: {
  studioId: string;
  studioName: string;
  logo: Logo;
  onSaved: (version: number, logo: Logo) => void;
}) {
  const id = useId();
  const [state, setState] = useState<State>({ status: "idle" });
  const busy = state.status === "busy";
  const failed = () => setState({ status: "error", message: "Le logo n’a pas pu être enregistré. Réessaie dans un instant." });

  const upload = async (file: File) => {
    const ext = extensionOf(file);
    if (!ext) return setState({ status: "error", message: "Formats acceptés : PNG, SVG, WebP ou JPEG." });
    if (file.size > LOGO_MAX_BYTES) return setState({ status: "error", message: "Le logo dépasse 5 Mo." });

    setState({ status: "busy" });
    const path = `${studioId}/brand/logo-${Date.now()}.${ext}`;
    const { error } = await supabaseBrowser()
      .storage.from("media")
      .upload(path, file, { contentType: file.type || (ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`) });
    if (error) return setState({ status: "error", message: "Le dépôt a échoué. Réessaie dans un instant." });

    const result = await saveLogo(path);
    if (result.status === "error") return setState(result);
    onSaved(result.version, result.logoUrl ? { url: result.logoUrl, source: "upload" } : null);
    setState({ status: "ok", message: `Logo enregistré (version ${result.version}).` });
  };

  const remove = async () => {
    setState({ status: "busy" });
    const result = await saveLogo(null);
    if (result.status === "error") return setState(result);
    onSaved(result.version, null);
    setState({ status: "ok", message: `Logo retiré (version ${result.version}). Les vidéos finiront sur le nom du studio.` });
  };

  return (
    <Section
      id="style-logo"
      title="Logo"
      hint="Il apparaît sur la carte de fin de chaque Reel. PNG ou SVG sur fond transparent de préférence, 5 Mo au maximum."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-28 w-full shrink-0 items-center justify-center rounded-[16px] border border-line bg-[repeating-conic-gradient(#f3f1f5_0_25%,#ffffff_0_50%)] bg-[length:16px_16px] p-3 sm:w-44"
          aria-busy={busy}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.url} alt={`Logo de ${studioName}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-center text-[13px] text-muted">Pas de logo : le nom du studio s’affiche à la place.</span>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          {logo?.source === "website" && <p className="text-sm text-muted">Logo trouvé sur ton site web.</p>}
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={id}
              className={`btn btn-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-violet ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            >
              <UploadIcon size={18} />
              {logo ? "Remplacer le logo" : "Déposer un logo"}
              <input
                id={id}
                type="file"
                accept={ACCEPT}
                disabled={busy}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload(file).catch(failed);
                }}
              />
            </label>
            {logo && (
              <button type="button" onClick={() => remove().catch(failed)} disabled={busy} className="btn btn-secondary disabled:opacity-50">
                <TrashIcon size={18} />
                Retirer le logo
              </button>
            )}
          </div>
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`min-h-5 text-sm font-semibold ${state.status === "error" ? "text-danger" : state.status === "ok" ? "text-success" : "text-muted"}`}
          >
            {state.status === "busy" ? "Enregistrement du logo…" : "message" in state ? state.message : ""}
          </p>
        </div>
      </div>
    </Section>
  );
}
