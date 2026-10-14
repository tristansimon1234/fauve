"use client";

import {
  buildSlideProps,
  CREDIT_PRICES,
  ELEMENT_ROLE_LABELS,
  ELEMENT_ROLES,
  placeElement,
  type ElementBox,
  type ElementRole,
  type LayerSlot,
  type ReelProps,
} from "@fauve/agent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DeleteButton } from "@/components/delete-button";
import { ImageIcon, XIcon } from "@/components/icons";
import { ElementHandles } from "@/components/montage/element-handles";
import { ElementThumb } from "@/components/montage/element-thumb";
import { SlidePreview } from "@/components/montage/slide-preview";
import { Orb } from "@/components/orb";
import { formatShortDateTime } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  archiveComponent,
  changeComponent,
  duplicateComponent,
  renameComponent,
  restoreComponent,
  saveComponentBox,
  saveComponentSample,
  setComponentRole,
  updateComponentPosts,
  type BankResult,
} from "../actions";

// One component of the studio's design system, on its own page: seen alone or
// on a photo (where it can be moved to set its usual place), its sample words,
// a change asked to Fauve (a new version), every previous version to go back
// to, and the upcoming posts that use it, to give them the new version.

type Element = {
  id: string;
  name: string;
  role: ElementRole;
  slots: LayerSlot[];
  js: string;
  fonts: string[];
  base: number;
  box: ElementBox | null;
  sample: Record<string, string>;
  kitName: string | null;
  note: string;
  updatedAt: string;
};
type Version = { name: string; js: string; fonts: string[]; base: number; sample: Record<string, string>; at: string };

const CHANGES = ["Plus grand", "Plus fin et élégant", "D’autres couleurs", "Plus arrondi", "Plus aéré", "Une autre police"];
const MAX_BYTES = 15 * 1024 * 1024;

export function ComponentStudio({
  studioId,
  brand,
  photoUrl,
  exampleUrl,
  element,
  history,
  posts,
  running,
}: {
  studioId: string;
  brand: ReelProps["brand"];
  photoUrl: string | null;
  exampleUrl: string | null;
  element: Element;
  history: Version[];
  posts: { id: string; title: string }[];
  running: { stage: string; since: string } | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<"alone" | "photo">(photoUrl ? "photo" : "alone");
  const [name, setName] = useState(element.name);
  const [sample, setSample] = useState(element.sample);
  const [box, setBox] = useState<ElementBox | null>(element.box);
  const [picked, setPicked] = useState<number | null>(null);
  const [change, setChange] = useState("");
  const [example, setExample] = useState<{ file: File; preview: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const stage = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // While Fauve works on it, the page catches up when the new version lands.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(timer);
  }, [running, router]);

  const source = useMemo(() => ({ ...element, sample }), [element, sample]);
  const placed = useMemo(() => placeElement(source, box ? { box } : {}), [source, box]);
  const inputsBrand = useMemo(() => ({ name: brand.name, accent: brand.accent, logoUrl: brand.logoUrl, fonts: [brand.displayFont, brand.bodyFont], customFonts: brand.customFonts }), [brand]);
  const slideProps = useMemo(
    () => (photoUrl ? buildSlideProps({ media_id: "00000000-0000-4000-8000-000000000000", texts: [], elements: [placed] }, { template: "doux", imageUrl: photoUrl, brand: inputsBrand }) : null),
    [photoUrl, placed, inputsBrand],
  );
  const sampleDirty = JSON.stringify(sample) !== JSON.stringify(element.sample);
  const boxDirty = JSON.stringify(box) !== JSON.stringify(element.box);

  const run = (action: () => Promise<BankResult>, after?: () => void) =>
    start(async () => {
      const res = await action().catch((): BankResult => ({ ok: false, error: "Ça n’a pas abouti. Réessaie." }));
      setMessage(res.ok ? (res.message ? { ok: true, text: res.message } : null) : { ok: false, text: res.error });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  const ask = () =>
    run(async () => {
      let examplePath: string | undefined;
      if (example) {
        const ext = example.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        examplePath = `${studioId}/elements/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabaseBrowser().storage.from("media").upload(examplePath, example.file, { contentType: example.file.type });
        if (error) return { ok: false, error: "L’envoi de l’image a échoué. Réessaie." };
      }
      return changeComponent(element.id, { change, examplePath });
    }, () => {
      setChange("");
      if (example) URL.revokeObjectURL(example.preview);
      setExample(null);
    });

  const card = "flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5";
  const field = "w-full rounded-[12px] border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-violet";

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="line-clamp-2 min-w-0 flex-1 text-[26px] leading-tight font-extrabold tracking-[-0.02em] sm:text-[28px]">{element.name}</h1>
          {photoUrl && (
            <div className="flex rounded-full bg-soft p-1" role="group" aria-label="Aperçu">
              {(
                [
                  ["photo", "Sur une photo"],
                  ["alone", "Seul"],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${view === v ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center rounded-[24px] bg-[radial-gradient(ellipse_at_top,#2a2145_0%,#16112a_70%)] p-5">
          {view === "photo" && slideProps ? (
            <div ref={stage} className="relative w-full max-w-[440px] overflow-hidden rounded-[16px] shadow-[0_24px_60px_rgba(0,0,0,.45)]">
              <SlidePreview props={slideProps} />
              <ElementHandles
                container={stage}
                elements={[placed]}
                selected={picked}
                onSelect={setPicked}
                onChange={(_, p) => {
                  if (p.box) setBox(p.box);
                  if (p.texts) setSample(p.texts);
                }}
                onRemove={() => setPicked(null)}
              />
            </div>
          ) : (
            <div className="w-full max-w-[520px] overflow-hidden rounded-[16px]">
              <ElementThumb element={{ js: element.js, texts: sample, fonts: element.fonts, base: element.base }} brand={brand} eager />
            </div>
          )}
        </div>
        {view === "photo" && (
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <span className="min-w-0 flex-1">Clique dessus puis glisse-le : c’est la place qu’il prendra par défaut. Clique un texte pour l’écrire.</span>
            {boxDirty && box && (
              <button type="button" disabled={pending} onClick={() => run(() => saveComponentBox(element.id, box))} className="btn btn-primary h-9 px-3.5 text-[13px]">
                Garder cette place
              </button>
            )}
          </div>
        )}
        {exampleUrl && (
          <div className="flex items-center gap-3 rounded-[16px] bg-soft p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={exampleUrl} alt="L’inspiration d’origine" className="h-20 w-16 rounded-[10px] object-cover" />
            <span className="text-[13px] leading-snug text-muted">
              Tiré de ton inspiration{element.kitName ? ` « ${element.kitName} »` : ""}.
            </span>
          </div>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`rounded-[14px] px-4 py-3 text-[13px] font-semibold ${message.ok ? "bg-violet-tint text-violet" : "bg-peach text-danger"}`}>
            {message.text}
          </p>
        )}

        <section className={card} aria-label="Nom et type">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted">Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== element.name && run(() => renameComponent(element.id, name))} maxLength={80} className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted">Type</span>
            <select value={element.role} onChange={(e) => run(() => setComponentRole(element.id, e.target.value))} className={field}>
              {ELEMENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ELEMENT_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={card} aria-label="Demander un changement">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Orb size={20} still />
            Demander un changement à Brigitte
          </h2>
          {running ? (
            <p className="flex items-center gap-2 rounded-[12px] bg-violet-tint px-3 py-2.5 text-[13px] font-semibold text-violet">
              <Orb size={18} />
              Nouvelle version en cours · {running.stage.toLowerCase()}
            </p>
          ) : (
            <>
              <textarea
                value={change}
                onChange={(e) => setChange(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Ex. l’étiquette plus arrondie, en bordeaux, avec une police plus fine"
                className={`${field} resize-none leading-snug`}
              />
              {!change && (
                <div className="flex flex-wrap gap-1.5">
                  {CHANGES.map((c) => (
                    <button key={c} type="button" onClick={() => setChange(c)} className="h-7 rounded-full bg-soft px-2.5 text-[12px] font-semibold hover:text-violet">
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {example ? (
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={example.preview} alt="" className="size-9 rounded-lg object-cover" />
                    <span className="truncate text-[12px] text-muted">Exemple joint</span>
                    <button
                      type="button"
                      aria-label="Retirer l’exemple"
                      onClick={() => {
                        URL.revokeObjectURL(example.preview);
                        setExample(null);
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft"
                    >
                      <XIcon size={13} />
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold text-violet hover:underline">
                    <ImageIcon size={15} />
                    Joindre un exemple
                  </button>
                )}
                <button type="button" disabled={pending || change.trim().length < 2} onClick={ask} className="btn btn-primary h-9 shrink-0 px-3.5 text-[13px] disabled:opacity-40">
                  Modifier · {CREDIT_PRICES.elementEdit} crédit
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file?.type.startsWith("image/") && file.size <= MAX_BYTES) setExample({ file, preview: URL.createObjectURL(file) });
                }}
              />
            </>
          )}
        </section>

        <section className={card} aria-label="Textes d’exemple">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">Textes d’exemple</h2>
            {sampleDirty && (
              <button type="button" disabled={pending} onClick={() => run(() => saveComponentSample(element.id, sample))} className="btn btn-primary h-8 px-3 text-[13px]">
                Enregistrer
              </button>
            )}
          </div>
          <p className="-mt-1 text-[12px] text-muted">Ce qu’il affiche dans ta banque. Sur une photo, Brigitte met tes vrais mots.</p>
          {element.slots.map((slot) => {
            const value = sample[slot.name] ?? "";
            const set = (text: string) => setSample({ ...sample, [slot.name]: text.slice(0, slot.max_chars) });
            return (
              <label key={slot.name} className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-muted first-letter:uppercase">
                  {slot.role}
                  {slot.multiline ? " · une ligne par élément" : ""}
                </span>
                {slot.multiline ? (
                  <textarea value={value} rows={Math.min(7, Math.max(2, value.split("\n").length + 1))} onChange={(e) => set(e.target.value)} className={field} />
                ) : (
                  <input value={value} maxLength={slot.max_chars} onChange={(e) => set(e.target.value)} className={field} />
                )}
              </label>
            );
          })}
        </section>

        {posts.length > 0 && (
          <section className={card} aria-label="Publications">
            <h2 className="text-[15px] font-bold">
              Sur {posts.length} publication{posts.length > 1 ? "s" : ""} à venir
            </h2>
            <ul className="flex flex-col gap-1">
              {posts.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/publications/${p.id}`} className="text-[13px] font-semibold text-ink hover:text-violet">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" disabled={pending} onClick={() => run(() => updateComponentPosts(element.id))} className="btn btn-secondary h-9 self-start px-3.5 text-[13px]">
              Leur mettre cette version
            </button>
          </section>
        )}

        <section className={card} aria-label="Versions">
          <h2 className="text-[15px] font-bold">Versions</h2>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-3">
              <div className="w-14 shrink-0 overflow-hidden rounded-[10px]">
                <ElementThumb element={{ js: element.js, texts: element.sample, fonts: element.fonts, base: element.base }} brand={brand} />
              </div>
              <span className="min-w-0 flex-1 text-[13px]">
                <span className="block font-bold">Actuelle</span>
                <span className="block text-muted">{formatShortDateTime(element.updatedAt, "Europe/Paris")}</span>
              </span>
            </li>
            {history.map((v, i) => (
              <li key={`${v.at}-${i}`} className="flex items-center gap-3">
                <div className="w-14 shrink-0 overflow-hidden rounded-[10px]">
                  <ElementThumb element={{ js: v.js, texts: v.sample, fonts: v.fonts, base: v.base }} brand={brand} />
                </div>
                <span className="min-w-0 flex-1 text-[13px]">
                  <span className="block truncate font-semibold">{v.name}</span>
                  <span className="block text-muted">{formatShortDateTime(v.at, "Europe/Paris")}</span>
                </span>
                <button type="button" disabled={pending} onClick={() => run(() => restoreComponent(element.id, i))} className="shrink-0 text-[12px] font-bold text-violet hover:underline disabled:opacity-40">
                  Revenir à celle-ci
                </button>
              </li>
            ))}
          </ul>
          {history.length === 0 && <p className="text-[12px] text-muted">Chaque changement garde la version d’avant ici.</p>}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await duplicateComponent(element.id).catch(() => ({ ok: false as const, error: "La copie a échoué." }));
                if (res.ok && "id" in res && res.id) router.push(`/composants/${res.id}`);
                else if (!res.ok) setMessage({ ok: false, text: res.error });
              })
            }
            className="text-[13px] font-bold text-muted hover:text-ink"
          >
            Dupliquer
          </button>
          <DeleteButton
            action={() => archiveComponent(element.id)}
            label="Retirer de ma banque"
            confirmText="Retirer ce composant ? Les publications déjà faites ne changent pas."
            redirectTo="/composants"
          />
        </div>
      </aside>
    </div>
  );
}
