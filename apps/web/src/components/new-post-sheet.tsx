"use client";

import type { PostKind } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ComponentType } from "react";
import { createPost } from "@/app/(app)/calendrier/actions";
import { newPostOptions, type NewPostOptions } from "@/app/(app)/new-post-actions";
import type { InspirationItem } from "@/lib/inspirations";
import { useFauveDrawer } from "./fauve-drawer";
import { ArrowLeftIcon, CheckIcon, FilmIcon, ImageIcon, LayersIcon, PlayIcon, PlusIcon, UploadIcon, XIcon } from "./icons";
import { InspirationPicker } from "./inspiration-picker";
import { buildSlideProps, placeElement } from "@fauve/agent";
import { SlidePreview } from "./montage/slide-preview";
import { Orb } from "./orb";

/** Where « Confier à Simone » goes: by default her panel; on the Simone page, its own conversation (no panel over the chat). */
export type NewPostHandOff = (start: { postId: string; text: string; files: File[] }) => void;
export const NewPostHandOffContext = createContext<NewPostHandOff | null>(null);

// « Nouvelle publication », step by step: the format, then what matters most,
// the inspiration (a Reel she likes; for photos, a kit of her components drawn
// on a photo, or a post she likes that Fauve turns into components), a free day
// Fauve suggests, photos and videos from the library (or new ones), and the
// idea in a line. Then Fauve takes over in her panel, or it is kept as an idea.

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

/** A few ideas to start from, by format, until the studio's own (by its kind of business) are loaded. */
const fallbackIdeas: Record<PostKind, string[]> = {
  reel: ["Les coulisses", "Un moment fort", "Une astuce", "Avant / après", "Une offre"],
  carousel: ["3 conseils", "Le planning de la semaine", "Une nouveauté", "Un témoignage", "Les tarifs"],
  post: ["Une nouveauté", "L’équipe", "Une offre", "Une citation"],
  story: ["Places restantes", "Coulisses du jour", "Un sondage", "Un rappel"],
};

const phrases: Record<PostKind, string> = { reel: "un Reel", carousel: "un carrousel", post: "un post photo", story: "une story" };

const styles = [
  { value: null, label: "Simone choisit" },
  { value: "doux", label: "Doux" },
  { value: "dynamique", label: "Dynamique" },
  { value: "chic", label: "Chic" },
  { value: "collage", label: "Collage" },
] as const;
type Style = (typeof styles)[number]["value"];
const styleHints: Record<NonNullable<Style>, string> = {
  doux: "élégant, des textes qui glissent",
  dynamique: "rythmé, des textes qui claquent",
  chic: "minimal, beaucoup d’espace",
  collage: "fait main, photos découpées, à la mode",
};

type Step = "format" | "when" | "files" | "idea" | "inspiration";
const stepTitles: Record<Step, string> = {
  format: "Quel format ?",
  when: "Quand la publier ?",
  files: "Avec quelles photos ou vidéos ?",
  idea: "Qu’est-ce que tu veux dire ?",
  inspiration: "Ton inspiration",
};

type Picked = { id: string; file: File; preview: string; video: boolean };

/** A soft placeholder photo, to show the text layouts before any photo is chosen. */
const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9cfc4"/><stop offset="1" stop-color="#8c7f93"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/></svg>',
)}`;

/** The day after `today` in the studio's time zone, as YYYY-MM-DD. */
function tomorrow(timezone: string): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

export function NewPostSheet({ date, timezone, onClose }: { date?: string; timezone: string; onClose: () => void }) {
  const router = useRouter();
  const openFauve = useFauveDrawer();
  const handOff = useContext(NewPostHandOffContext);
  const titleId = useId();
  const [options, setOptions] = useState<NewPostOptions | null>(null);
  const [step, setStep] = useState<Step>("format");
  const [kind, setKind] = useState<PostKind>("reel");
  const [day, setDay] = useState(date ?? "");
  const [time, setTime] = useState("18:00");
  const [otherDate, setOtherDate] = useState(Boolean(date));
  const [chosen, setChosen] = useState<string[]>([]);
  const [files, setFiles] = useState<Picked[]>([]);
  const [intention, setIntention] = useState("");
  const [style, setStyle] = useState<Style>(null);
  const [inspiration, setInspiration] = useState<InspirationItem | null>(null);
  const [kit, setKit] = useState<NewPostOptions["kits"][number] | null>(null);
  /** A picture of a post she likes: Fauve redraws the same layout on her photos. */
  const [example, setExample] = useState<Picked | null>(null);
  const exampleRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Everything the steps offer, loaded once when the sheet opens.
  useEffect(() => {
    let live = true;
    newPostOptions()
      .then((o) => {
        if (!live || !o) return;
        setOptions(o);
        if (!date && o.slots[0]) {
          setDay(o.slots[0].date);
          setTime(o.slots[0].time);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [date]);

  useEffect(() => {
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

  const video = kind === "reel" || kind === "story";
  // The inspiration right after the format: it is what the rest is built on.
  const steps: Step[] = ["format", "inspiration", "when", "files", "idea"];
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;
  const go = (to: number) => {
    const next = steps[Math.max(0, Math.min(steps.length - 1, to))]!;
    setStep(next);
    setError(null);
    panelRef.current?.scrollTo({ top: 0 });
  };

  const add = (list: FileList | File[]) => {
    const picked = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (picked.length < list.length) setError("Seules les photos et les vidéos passent ici.");
    if (picked.some((f) => f.size > MAX_FILE_BYTES)) setError("Un fichier dépasse 50 Mo : envoie-le plutôt sur WhatsApp en tant que document.");
    const kept = picked
      .filter((f) => f.size <= MAX_FILE_BYTES)
      .slice(0, MAX_FILES - files.length - chosen.length)
      .map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}`, file, preview: URL.createObjectURL(file), video: file.type.startsWith("video/") }));
    setFiles((current) => [...current, ...kept.filter((k) => !current.some((c) => c.id === k.id))]);
  };
  const remove = (id: string) =>
    setFiles((current) => {
      const gone = current.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((f) => f.id !== id);
    });
  const toggle = (id: string) =>
    setChosen((current) => (current.includes(id) ? current.filter((c) => c !== id) : current.length + files.length >= MAX_FILES ? current : [...current, id]));

  // The library, the format's files first (videos for a Reel, photos for a carousel).
  const library = (options?.media ?? []).filter((m) => kind !== "post" || !m.video);
  const sorted = [...library].sort((a, b) => Number(b.video === video) - Number(a.video === video));
  const firstPhoto = options?.media.find((m) => chosen.includes(m.id) && !m.video)?.url ?? files.find((f) => !f.video)?.preview ?? PLACEHOLDER;
  const count = chosen.length + files.length;

  const submit = (toFauve: boolean) =>
    start(async () => {
      setError(null);
      const res = await createPost({
        kind,
        date: day,
        time,
        intention,
        template: video ? style : null,
        inspirationId: video ? (inspiration?.id ?? null) : null,
        mediaIds: chosen,
      }).catch(() => ({ ok: false as const, error: "La publication n’a pas été créée. Réessaie." }));
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
          kit ? `Composants à poser sur mes photos : le kit « ${kit.name} » (element_id ${kit.elements.map((e) => e.id).join(", ")}).` : "",
          chosen.length ? `Fichiers choisis dans la médiathèque (media_id, dans l’ordre) : ${chosen.join(", ")}.` : "",
          files.length ? "Voici mes nouveaux fichiers." : "",
          example ? "La dernière image envoyée est une inspiration, un post que j’aime (pas une photo à publier) : crée mes composants à partir d’elle et pose-les sur mes photos." : "",
          !count ? "Je n’ai pas encore de photos ni de vidéos : dis-moi quoi filmer, ou propose-moi des images d’ambiance." : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        const handed = [...files.map((f) => f.file), ...(example ? [example.file] : [])];
        if (handOff) handOff({ postId: res.id, text, files: handed });
        else openFauve({ postId: res.id, title: res.title, start: { text, files: handed } });
      }
      onClose();
    });

  const card = (on: boolean) => `fauve-press border transition-colors ${on ? "border-violet bg-violet-soft text-violet" : "border-line bg-white text-ink hover:border-violet/40"}`;
  const slot = options?.slots.find((s) => s.date === day && s.time === time);
  const canNext = step !== "when" || Boolean(day && time);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={onClose} className="fauve-fade absolute inset-0 bg-ink/35" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fauve-enter relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] bg-white shadow-[0_-12px_40px_rgba(28,21,48,0.18)] sm:max-w-[560px] sm:rounded-[22px]"
      >
        <header className="flex flex-col gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button type="button" onClick={() => go(index - 1)} aria-label="Étape précédente" className="-ml-2 flex size-9 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink">
                <ArrowLeftIcon size={18} />
              </button>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] font-semibold text-muted">
                Nouvelle publication · {index + 1}/{steps.length}
              </span>
              <h2 id={titleId} className="text-[20px] leading-tight font-extrabold tracking-[-0.01em]">
                {stepTitles[step]}
              </h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink">
              <XIcon size={18} />
            </button>
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= index ? "bg-violet" : "bg-line"}`} />
            ))}
          </div>
        </header>

        <div ref={panelRef} key={step} className="fauve-fade flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
          {step === "format" && (
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Format">
              {formats.map((f) => {
                const on = kind === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setKind(f.value);
                      setKit(null);
                      go(1);
                    }}
                    className={`${card(on)} flex flex-col items-start gap-2 rounded-[18px] p-4 text-left`}
                  >
                    <span className={`flex size-10 items-center justify-center rounded-full ${on ? "bg-white" : "bg-violet-soft text-violet"}`}>
                      <f.Icon size={20} />
                    </span>
                    <span className="text-[15px] font-bold">{f.label}</span>
                    <span className={`text-[12px] ${on ? "text-violet/80" : "text-muted"}`}>{f.hint}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === "when" && (
            <>
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Jours proposés">
                {options === null &&
                  [0, 1, 2, 3].map((i) => <span key={i} className="h-[68px] animate-pulse rounded-[16px] bg-soft" aria-hidden />)}
                {options?.slots.map((s) => {
                  const on = !otherDate && s.date === day && s.time === time;
                  return (
                    <button
                      key={s.date}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        setDay(s.date);
                        setTime(s.time);
                        setOtherDate(false);
                      }}
                      className={`${card(on)} relative flex flex-col items-start gap-0.5 rounded-[16px] px-3.5 py-3 text-left`}
                    >
                      <span className="text-[15px] font-bold first-letter:uppercase">
                        {s.label} · {s.time.replace(":", " h ").replace(/ 00$/, "")}
                      </span>
                      <span className={`text-[12px] ${on ? "text-violet/80" : "text-muted"}`}>{s.hint}</span>
                      {on && <Tick />}
                    </button>
                  );
                })}
              </div>
              {options && !options.slots.length && <p className="text-[13px] text-muted">Tes deux prochaines semaines sont déjà bien remplies : choisis une date.</p>}
              <button
                type="button"
                onClick={() => {
                  setOtherDate(true);
                  if (!day) setDay(tomorrow(timezone));
                }}
                className={`self-start text-[13px] font-bold ${otherDate ? "text-ink" : "text-violet hover:underline"}`}
              >
                Une autre date
              </button>
              {(otherDate || (options && !options.slots.length)) && (
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
              )}
              {slot && !otherDate && <p className="text-[12px] text-muted">Simone propose tes jours libres, à ton heure habituelle.</p>}
            </>
          )}

          {step === "files" && (
            <>
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
                <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl py-2 text-[14px] font-bold text-violet hover:bg-white">
                  <UploadIcon size={18} />
                  {files.length ? "Ajouter d’autres fichiers" : "Ajouter depuis ton appareil"}
                </button>
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

              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold">Dans ta médiathèque</span>
                {count > 0 && <span className="text-[12px] font-semibold text-violet">{count} choisi{count > 1 ? "s" : ""}</span>}
              </div>
              {options === null ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className="aspect-square animate-pulse rounded-xl bg-soft" aria-hidden />
                  ))}
                </div>
              ) : sorted.length ? (
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {sorted.map((m) => {
                    const at = chosen.indexOf(m.id);
                    const on = at >= 0;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${m.video ? "Vidéo" : "Photo"} du ${new Date(m.at).toLocaleDateString("fr-FR")}`}
                          onClick={() => toggle(m.id)}
                          className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-ink transition-shadow ${on ? "ring-2 ring-violet ring-offset-2" : "hover:opacity-90"}`}
                        >
                          {m.video ? (
                            <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.url} alt="" loading="lazy" className="size-full object-cover" />
                          )}
                          {m.video && (
                            <span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white">
                              <PlayIcon size={10} />
                            </span>
                          )}
                          {on && (
                            <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-violet text-[11px] font-bold text-white">{at + 1}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">Ta médiathèque est vide pour l’instant.</p>
              )}
              {!count && <p className="text-[12px] text-muted">Rien sous la main ? Passe à la suite : Simone te dira quoi filmer.</p>}
            </>
          )}

          {step === "idea" && (
            <>
              <textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                maxLength={300}
                rows={3}
                autoFocus
                placeholder={placeholders[kind]}
                className="rounded-[14px] border border-line bg-white px-3.5 py-3 text-[15px] leading-snug outline-none focus:border-violet"
              />
              <div className="flex flex-wrap gap-1.5" aria-label="Idées">
                {(options?.ideas ?? fallbackIdeas)[kind].map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setIntention((v) => (v.trim() ? `${v.trim()}, ${idea.toLowerCase()}` : idea))}
                    className="fauve-press inline-flex h-8 items-center gap-1 rounded-full border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:border-violet/40"
                  >
                    <PlusIcon size={13} />
                    {idea}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-muted">En une ligne suffit. Simone connaît ton commerce et écrit la légende.</p>
            </>
          )}

          {step === "inspiration" && video && (
            <>
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
                <p className="text-[12px] text-muted">{style ? `${styles.find((s) => s.value === style)!.label} : ${styleHints[style]}.` : "Simone prend ton style habituel, ou celui de ton inspiration."}</p>
              </fieldset>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">Un Reel à suivre</span>
                <InspirationPicker
                  value={inspiration?.id ?? null}
                  onChange={setInspiration}
                  initial={options ? { studioId: options.studioId, items: options.inspirations } : null}
                />
              </div>
            </>
          )}

          {step === "inspiration" && !video && options && options.kits.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">Tes composants</span>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kits de composants">
                <button
                  type="button"
                  role="radio"
                  aria-checked={kit === null && !example}
                  onClick={() => setKit(null)}
                  className={`${card(kit === null && !example)} relative flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-[14px] p-2 text-center`}
                >
                  <Orb size={26} still />
                  <span className="text-[12px] font-bold">Simone choisit</span>
                </button>
                {options.kits.map((k) => {
                  const on = kit?.id === k.id;
                  const photo = firstPhoto === PLACEHOLDER ? (options.media.find((m) => !m.video)?.url ?? PLACEHOLDER) : firstPhoto;
                  const props = buildSlideProps({ media_id: "00000000-0000-4000-8000-000000000000", texts: [], elements: k.elements.map((e) => placeElement(e)) }, { template: "doux", imageUrl: photo, brand: options.brand });
                  return (
                    <button
                      key={k.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={k.name}
                      onClick={() => {
                        setKit(k);
                        if (example) URL.revokeObjectURL(example.preview);
                        setExample(null);
                      }}
                      className={`relative overflow-hidden rounded-[14px] transition-shadow ${on ? "ring-2 ring-violet ring-offset-2" : "hover:ring-2 hover:ring-violet/40"}`}
                    >
                      <SlidePreview props={props} />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-left text-[11px] font-bold text-white">{k.name}</span>
                      {on && <Tick />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "inspiration" && !video && options && (
            <div className="flex flex-col gap-2 rounded-[16px] bg-soft p-3">
              <span className="text-[13px] font-bold">{options.kits.length ? "Ou une nouvelle inspiration" : "Montre un post qui te plaît"}</span>
              {example ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={example.preview} alt="" className="h-20 w-16 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted">Simone en tire tes composants (titre, étiquette, liste…), les garde dans ta banque et les pose sur tes photos (3 crédits).</span>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(example.preview);
                      setExample(null);
                    }}
                    aria-label="Retirer l’exemple"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
                  >
                    <XIcon size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => exampleRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[14px] font-bold text-violet hover:bg-violet-soft">
                    <UploadIcon size={17} />
                    Envoyer une capture d’un post
                  </button>
                  <span className="text-[12px] text-muted">Une capture d’écran d’un carrousel ou d’une affiche que tu aimes : Simone en tire des composants réutilisables, à tes couleurs.</span>
                </>
              )}
              <input
                ref={exampleRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) return;
                  if (example) URL.revokeObjectURL(example.preview);
                  setExample({ id: `example-${file.name}-${file.size}`, file, preview: URL.createObjectURL(file), video: false });
                  setKit(null);
                }}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
        </div>

        {step !== "format" && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {last ? (
              <>
                <button type="button" disabled={pending} onClick={() => submit(false)} className="btn btn-secondary">
                  Garder comme idée
                </button>
                <button type="button" disabled={pending || !day} onClick={() => submit(true)} className="btn btn-primary">
                  <Orb size={18} still />
                  {pending ? "Un instant…" : "Confier à Simone"}
                </button>
              </>
            ) : (
              <>
                {(step === "files" || (step === "idea" && !intention.trim())) && (
                  <button type="button" onClick={() => go(index + 1)} className="btn btn-secondary">
                    {step === "files" && !count ? "Je n’ai rien pour l’instant" : "Passer"}
                  </button>
                )}
                <button type="button" disabled={!canNext} onClick={() => go(index + 1)} className="btn btn-primary">
                  Continuer
                </button>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

function Tick() {
  return (
    <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-violet text-white">
      <CheckIcon size={12} />
    </span>
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
