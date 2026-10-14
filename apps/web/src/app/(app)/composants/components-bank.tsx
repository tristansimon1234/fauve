"use client";

import { CREDIT_PRICES, ELEMENT_ROLE_LABELS, type ElementRole, type ReelProps } from "@fauve/agent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImageIcon, PlusIcon, XIcon } from "@/components/icons";
import { ElementThumb } from "@/components/montage/element-thumb";
import { Orb } from "@/components/orb";
import { supabaseBrowser } from "@/lib/supabase/client";
import { createComponents } from "./actions";

// The studio's design system: every component Fauve took out of its
// inspirations (titles, tags, checklists…), grouped by kit, drawn live. A new
// inspiration starts here; a card opens the component's page.

export type BankCard = {
  id: string;
  name: string;
  role: ElementRole;
  js: string;
  fonts: string[];
  base: number;
  sample: Record<string, string>;
  kitId: string | null;
  kitName: string | null;
  uses: number;
  versions: number;
  updatedAt: string;
};

const IDEAS = ["Une checklist de ce qu’il faut apporter", "Une étiquette « Nouveau »", "Un prix dans un rond", "Un titre d’affiche", "Une citation d’élève"];
const MAX_BYTES = 15 * 1024 * 1024;

function NewInspiration({ studioId, onDone }: { studioId: string; onDone: (message: string) => void }) {
  const [text, setText] = useState("");
  const [example, setExample] = useState<{ file: File; preview: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Ajoute une image (une capture d’écran d’un post qui te plaît).");
    if (file.size > MAX_BYTES) return setError("Cette image dépasse 15 Mo.");
    if (example) URL.revokeObjectURL(example.preview);
    setExample({ file, preview: URL.createObjectURL(file) });
  };

  const submit = () =>
    start(async () => {
      setError(null);
      let examplePath: string | undefined;
      if (example) {
        const ext = example.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        examplePath = `${studioId}/elements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabaseBrowser().storage.from("media").upload(examplePath, example.file, { contentType: example.file.type });
        if (uploadError) return setError("L’envoi de l’image a échoué. Réessaie.");
      }
      const res = await createComponents({ request: text, examplePath }).catch(() => ({ ok: false as const, error: "Ça n’a pas pu partir. Réessaie." }));
      if (!res.ok) return setError(res.error);
      setText("");
      if (example) URL.revokeObjectURL(example.preview);
      setExample(null);
      onDone(res.message ?? "C’est parti.");
    });

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className="relative flex aspect-[4/5] w-full shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-[16px] border-[1.5px] border-dashed border-lilac bg-violet-tint text-violet sm:w-[150px]"
        >
          {example ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={example.preview} alt="Ton inspiration" className="absolute inset-0 size-full object-cover" />
          ) : (
            <>
              <ImageIcon size={22} />
              <span className="px-3 text-center text-[12px] font-bold leading-snug">Ton inspiration</span>
              <span className="px-3 text-center text-[11px] leading-snug text-muted">La capture d’un post qui te plaît</span>
            </>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-bold">Que veux-tu en tirer ?</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder={example ? "Facultatif : Brigitte en sort chaque pièce (titre, étiquette, liste…). Dis-lui si tu veux seulement une partie." : "Ex. une checklist de ce qu’il faut apporter au cours, une étiquette « Nouveau »"}
              className="resize-none rounded-[12px] border border-line bg-white px-3 py-2 text-[14px] leading-snug outline-none focus:border-violet"
            />
          </label>
          {!text && (
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setText(idea)} className="h-7 rounded-full bg-soft px-2.5 text-[12px] font-semibold text-ink hover:text-violet">
                  {idea}
                </button>
              ))}
            </div>
          )}
          {example && (
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(example.preview);
                setExample(null);
              }}
              className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-muted hover:text-ink"
            >
              <XIcon size={12} />
              Retirer l’inspiration
            </button>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
            <button type="button" disabled={pending || (!text.trim() && !example)} onClick={submit} className="btn btn-primary h-10 px-4 text-[14px] disabled:opacity-40">
              {pending ? "Envoi…" : "Créer mes composants"}
            </button>
            <span className="text-[12px] text-muted">{CREDIT_PRICES.textLayer} crédits · 2 à 4 minutes · testés et relus par Brigitte</span>
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
    </div>
  );
}

export function ComponentsBank({
  studioId,
  brand,
  elements,
  creating,
  highlight,
}: {
  studioId: string;
  brand: ReelProps["brand"];
  elements: BankCard[];
  /** New kits being made right now. */
  creating: number;
  /** A component of the kit to show first (from Fauve's message). */
  highlight: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(elements.length === 0);
  const [role, setRole] = useState<ElementRole | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // While a kit is being made, the page catches up when it lands (StudioLive refreshes on studio_jobs).
  useEffect(() => {
    if (!creating) return;
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(timer);
  }, [creating, router]);

  const roles = [...new Set(elements.map((e) => e.role))];
  const shown = role ? elements.filter((e) => e.role === role) : elements;
  const kits = new Map<string, { name: string; items: BankCard[] }>();
  for (const e of shown) {
    const id = e.kitId ?? e.id;
    const kit = kits.get(id) ?? { name: e.kitName ?? e.name, items: [] };
    kit.items.push(e);
    kits.set(id, kit);
  }
  const highlightKit = highlight ? (elements.find((e) => e.id === highlight)?.kitId ?? highlight) : null;
  const ordered = [...kits.entries()].sort(([a], [b]) => Number(b === highlightKit) - Number(a === highlightKit));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <p className="text-[15px] leading-relaxed text-muted">
            Les titres, étiquettes, listes… que Brigitte a tirés de tes inspirations. Elle les pose sur tes photos avec tes mots, et tu peux retoucher chacun à part.
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary h-11 text-[14px]">
            <PlusIcon size={17} />
            Nouvelle inspiration
          </button>
        )}
      </div>

      {open && (
        <div className="flex max-w-[860px] flex-col gap-2">
          <NewInspiration
            studioId={studioId}
            onDone={(message) => {
              setNotice(message);
              setOpen(false);
              router.refresh();
            }}
          />
          {elements.length > 0 && (
            <button type="button" onClick={() => setOpen(false)} className="self-start text-[13px] font-semibold text-muted hover:text-ink">
              Fermer
            </button>
          )}
        </div>
      )}

      {(creating > 0 || notice) && (
        <div className="fauve-enter flex max-w-[860px] items-center gap-3 rounded-[16px] bg-violet-tint px-4 py-3 text-[14px] text-violet">
          <Orb size={26} />
          <span className="min-w-0 flex-1 font-semibold">{creating > 0 ? "Brigitte découpe ton inspiration en composants, les teste et les relit. Ils arrivent ici tout seuls." : notice}</span>
        </div>
      )}

      {roles.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par type">
          {[null, ...roles].map((r) => (
            <button
              key={r ?? "all"}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${role === r ? "bg-ink text-white" : "bg-soft text-muted hover:text-ink"}`}
            >
              {r ? ELEMENT_ROLE_LABELS[r] : "Tout"}
            </button>
          ))}
        </div>
      )}

      {ordered.map(([id, kit]) => (
        <section key={id} aria-label={kit.name} className={`flex flex-col gap-3 ${id === highlightKit ? "fauve-enter" : ""}`}>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[17px] font-bold">{kit.name}</h2>
            <span className="text-[13px] text-muted">
              {kit.items.length} composant{kit.items.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
            {kit.items.map((e) => (
              <li key={e.id}>
                <Link href={`/composants/${e.id}`} className="group flex flex-col overflow-hidden rounded-[18px] border border-line bg-white transition-shadow hover:shadow-[0_10px_30px_rgba(28,21,48,0.1)]">
                  <ElementThumb element={{ js: e.js, texts: e.sample, fonts: e.fonts, base: e.base }} brand={brand} />
                  <span className="flex flex-col gap-0.5 p-3">
                    <span className="line-clamp-2 text-[14px] leading-snug font-semibold group-hover:text-violet">{e.name}</span>
                    <span className="text-xs font-semibold text-muted">
                      {ELEMENT_ROLE_LABELS[e.role]}
                      {e.uses ? ` · utilisé ${e.uses} fois` : ""}
                      {e.versions ? ` · v${e.versions + 1}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
