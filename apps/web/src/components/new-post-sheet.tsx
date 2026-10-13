"use client";

import type { PostKind } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ComponentType } from "react";
import { createPost } from "@/app/(app)/calendrier/actions";
import type { InspirationItem } from "@/lib/inspirations";
import { useFauveDrawer } from "./fauve-drawer";
import { InspirationPicker } from "./inspiration-picker";
import { FilmIcon, ImageIcon, LayersIcon, PlayIcon, PlusIcon, UploadIcon, XIcon } from "./icons";
import { Orb } from "./orb";

// « Nouvelle publication »: one screen, four answers (format, files, what it
// should say, when), then Fauve takes over in her panel: caption, montage or
// text on the photos, with a quote when it costs credits. Or kept as an idea.

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;

const formats: { value: PostKind; label: string; hint: string; Icon: ComponentType<{ size?: number }> }[] = [
  { value: "reel", label: "Reel", hint: "Une vidéo montée", Icon: FilmIcon },
  { value: "carousel", label: "Carrousel", hint: "2 à 10 photos", Icon: LayersIcon },
  { value: "post", label: "Photo", hint: "Une photo", Icon: ImageIcon },
  { value: "story", label: "Story", hint: "24 h", Icon: PlayIcon },
];

const placeholders: Record<PostKind, string> = {
  reel: "Ex. le cours du samedi matin, ambiance énergique",
  carousel: "Ex. 3 conseils pour bien commencer",
  post: "Ex. nouvelle carte d’automne",
  story: "Ex. il reste 2 places ce soir",
};

/** The montage styles (Remotion templates), for a Reel or a story. */
const styles = [
  { value: null, label: "Fauve choisit" },
  { value: "doux", label: "Doux" },
  { value: "dynamique", label: "Dynamique" },
  { value: "chic", label: "Chic" },
] as const;
type Style = (typeof styles)[number]["value"];
const styleHints: Record<NonNullable<Style>, string> = {
  doux: "élégant, des textes qui glissent",
  dynamique: "rythmé, des textes qui claquent",
  chic: "minimal, beaucoup d’espace",
};

const phrases: Record<PostKind, string> = { reel: "un Reel", carousel: "un carrousel", post: "un post photo", story: "une story" };

type Picked = { id: string; file: File; preview: string; video: boolean };

/** The day after `today` in the studio's time zone, as YYYY-MM-DD. */
function tomorrow(timezone: string): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

export function NewPostSheet({ date, timezone, onClose }: { date?: string; timezone: string; onClose: () => void }) {
  const router = useRouter();
  const openFauve = useFauveDrawer();
  const titleId = useId();
  const [kind, setKind] = useState<PostKind>("reel");
  const [files, setFiles] = useState<Picked[]>([]);
  const [intention, setIntention] = useState("");
  const [day, setDay] = useState(date ?? tomorrow(timezone));
  const [time, setTime] = useState("18:00");
  const [style, setStyle] = useState<Style>(null);
  const [inspiration, setInspiration] = useState<InspirationItem | null>(null);
  const video = kind === "reel" || kind === "story";
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // The previews are freed when the panel goes (the files themselves travel to Fauve's panel).
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const add = (list: FileList | File[]) => {
    const picked = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (picked.length < list.length) setError("Seules les photos et les vidéos passent ici.");
    if (picked.some((f) => f.size > MAX_FILE_BYTES)) setError("Un fichier dépasse 50 Mo : envoie-le plutôt sur WhatsApp en tant que document.");
    const kept = picked
      .filter((f) => f.size <= MAX_FILE_BYTES)
      .slice(0, MAX_FILES - files.length)
      .map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}`, file, preview: URL.createObjectURL(file), video: file.type.startsWith("video/") }));
    setFiles((current) => [...current, ...kept.filter((k) => !current.some((c) => c.id === k.id))]);
  };

  const remove = (id: string) =>
    setFiles((current) => {
      const gone = current.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((f) => f.id !== id);
    });

  const submit = (toFauve: boolean) =>
    start(async () => {
      setError(null);
      const res = await createPost({ kind, date: day, time, intention, template: video ? style : null, inspirationId: video ? (inspiration?.id ?? null) : null }).catch(() => ({ ok: false as const, error: "La publication n’a pas été créée. Réessaie." }));
      if (!res.ok) return setError(res.error);
      router.refresh();
      if (toFauve) {
        const when = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
        const text = [
          `Nouvelle publication : ${phrases[kind]} pour ${when} à ${time.replace(":", " h ")}.`,
          intention.trim() ? `L’idée : ${intention.trim()}` : "",
          video && (style || inspiration)
            ? [style ? `Style : ${styles.find((s) => s.value === style)!.label}.` : "", inspiration ? `Inspiration : « ${inspiration.title} ».` : ""].filter(Boolean).join(" ")
            : "",
          files.length ? "Voici mes fichiers." : "Je n’ai pas encore de photos ni de vidéos : dis-moi quoi filmer.",
        ]
          .filter(Boolean)
          .join("\n\n");
        openFauve({ postId: res.id, title: res.title, start: { text, files: files.map((f) => f.file) } });
      }
      onClose();
    });

  const chip = "fauve-press flex flex-col items-center gap-1 rounded-[16px] border px-2 py-3 text-center transition-colors";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={onClose} className="fauve-fade absolute inset-0 bg-ink/35" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fauve-enter relative flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-[22px] bg-white p-5 shadow-[0_-12px_40px_rgba(28,21,48,0.18)] sm:max-w-[540px] sm:rounded-[22px] sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-[20px] font-extrabold tracking-[-0.01em]">
            Nouvelle publication
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink">
            <XIcon size={18} />
          </button>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-bold">Format</legend>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Format">
            {formats.map((f, i) => {
              const on = kind === f.value;
              return (
                <button
                  key={f.value}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKind(f.value)}
                  className={`${chip} ${on ? "border-violet bg-violet-soft text-violet" : "border-line bg-white text-ink hover:border-violet/40"}`}
                >
                  <f.Icon size={20} />
                  <span className="text-[13px] font-bold">{f.label}</span>
                  <span className={`hidden text-[11px] leading-tight sm:block ${on ? "text-violet/80" : "text-muted"}`}>{f.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold">
            Tes photos et vidéos <span className="font-semibold text-muted">· facultatif</span>
          </span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(e.dataTransfer.files);
            }}
            className={`flex flex-col gap-3 rounded-[16px] border-[1.5px] border-dashed p-3 transition-colors ${dragging ? "border-violet bg-violet-soft" : "border-line bg-soft"}`}
          >
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f) => (
                  <li key={f.id} className="fauve-pop relative size-16 overflow-hidden rounded-xl bg-ink">
                    {f.video ? (
                      <video src={f.preview} muted playsInline preload="metadata" className="size-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" className="size-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      aria-label={`Retirer ${f.file.name}`}
                      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm"
                    >
                      <XIcon size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl py-2 text-[14px] font-bold text-violet hover:bg-white"
            >
              <UploadIcon size={18} />
              {files.length ? "Ajouter d’autres fichiers" : "Glisse tes fichiers ici, ou choisis-les"}
            </button>
            {!files.length && <p className="-mt-2 text-center text-[12px] text-muted">Sans fichier, Fauve te dira quoi filmer.</p>}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) add(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {video && (
          <div className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[13px] font-bold">Style du montage</legend>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Style du montage">
                {styles.map((s) => {
                  const on = style === s.value;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setStyle(s.value)}
                      className={`fauve-press h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${on ? "border-violet bg-violet text-white" : "border-line bg-white text-ink hover:border-violet/40"}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] text-muted">{style ? `${styles.find((s) => s.value === style)!.label} : ${styleHints[style]}.` : "Fauve prend ton style habituel, ou celui de ton inspiration."}</p>
            </fieldset>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">
                Inspiration <span className="font-semibold text-muted">· facultatif</span>
              </span>
              <InspirationPicker value={inspiration?.id ?? null} onChange={setInspiration} />
            </div>
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-bold">
            Ce que tu veux dire <span className="font-semibold text-muted">· en une ligne</span>
          </span>
          <input
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            maxLength={300}
            placeholder={placeholders[kind]}
            className="h-11 rounded-[12px] border border-line bg-white px-3 text-[15px] outline-none focus:border-violet"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold">Quand</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              aria-label="Jour"
              className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-white px-3 text-[15px] outline-none focus:border-violet"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Heure"
              className="h-11 w-[136px] rounded-[12px] border border-line bg-white px-3 text-[15px] outline-none focus:border-violet"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={pending} onClick={() => submit(false)} className="btn btn-secondary">
            Garder comme idée
          </button>
          <button type="button" disabled={pending} onClick={() => submit(true)} className="btn btn-primary">
            <Orb size={18} still />
            {pending ? "Un instant…" : "Confier à Fauve"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The button that opens the panel (calendar header). */
export function NewPostButton({ timezone, className = "btn btn-primary" }: { timezone: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <PlusIcon size={18} />
        Nouvelle publication
      </button>
      {open && <NewPostSheet timezone={timezone} onClose={() => setOpen(false)} />}
    </>
  );
}
