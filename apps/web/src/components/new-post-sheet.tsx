"use client";

import {
  advisedFormat,
  creationSteps,
  EFFECT_MINUTES,
  findVoice,
  formatBlocked,
  formatWhy,
  publishWhen,
  SIMONE_VOICES,
  voiceSamplePath,
  type Effort,
  type Picked,
  type PostKind,
} from "@fauve/agent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { creationProgress, launchCreation, type CreationProgress, type LaunchResult } from "@/app/(app)/create-actions";
import { MAX_FILES, useChatUploads, type DraftFile } from "@/app/(app)/fauve/chat-uploads";
import { newPostOptions, type NewPostOptions } from "@/app/(app)/new-post-actions";
import { useFauveDrawer } from "./fauve-drawer";
import { publicEnv } from "@/lib/public-env";
import { CalendarIcon, CheckIcon, ChevronRightIcon, FilmIcon, ImageIcon, LayersIcon, MicIcon, PaletteIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from "./icons";
import { Mascot } from "./mascot";
import { nudgeWork } from "./work-pill";

/** Where a carousel, a photo or a story goes on: by default Simone's panel; on the Simone page, its own conversation. */
export type NewPostHandOff = (start: { postId: string; text: string; files: File[] }) => void;
export const NewPostHandOffContext = createContext<NewPostHandOff | null>(null);

// « Nouvelle publication », in one screen: she gives her photos and videos (her library
// or her phone), says what it is about if she wants, and Simone says what she will make
// of them (« J'en fais un Reel, publié vendredi à 18 h »), both changeable in a tap.
// « C'est parti »: a Reel starts at once and the screen follows it (« Je m'en occupe »);
// a carousel, a photo or a story goes on with Simone in the chat, who writes the texts.

const FORMATS: { kind: PostKind; title: string; phrase: string; hint: string; Icon: typeof FilmIcon }[] = [
  { kind: "reel", title: "Un Reel", phrase: "un Reel", hint: "Une vidéo montée, avec musique", Icon: FilmIcon },
  { kind: "carousel", title: "Un carrousel", phrase: "un carrousel", hint: "Tes photos, à faire défiler", Icon: LayersIcon },
  { kind: "post", title: "Une photo", phrase: "un post photo", hint: "Une seule image, dans ta grille", Icon: ImageIcon },
  { kind: "story", title: "Une story", phrase: "une story", hint: "Visible 24 h, pour un rappel ou une info du jour", Icon: PlayIcon },
];

/** What « Ce que tu imagines » can say: the scenario, in her words. */
const SCENARIO_EXAMPLE: Record<PostKind, string> = {
  reel: "Ex. on commence par l’avant, puis le geste, et on finit sur le résultat avec l’offre du mois.",
  carousel: "Ex. 3 conseils pour l’hiver, un par photo, et l’offre sur la dernière.",
  post: "Ex. la nouveauté de la semaine, avec le prix.",
  story: "Ex. il reste 2 places jeudi soir.",
};

const SAMPLES = `${publicEnv.supabaseUrl}/storage/v1/object/public/landing`;

/** Her studio's voice setting (Style), as the first choice: « Simone choisit », without, or its voice. */
function defaultVoice(o: NewPostOptions | null): string {
  if (!o || o.voice.use === "auto") return "auto";
  if (o.voice.use === "never") return "off";
  return o.voice.voiceId && findVoice(o.voice.voiceId) ? o.voice.voiceId : SIMONE_VOICES[0]!.id;
}

/** Under « Voix off »: « Simone choisit », « Aucune », « Eva ». */
function voiceLabel(voice: string): string {
  if (voice === "auto") return "Simone choisit";
  if (voice === "off") return "Aucune";
  return findVoice(voice)?.name ?? "Simone choisit";
}

const placeLabel = (platforms: string[]) => platforms.map((p) => (p === "tiktok" ? "TikTok" : "Instagram")).join(" et ");

/** The first library items shown (with the upload tile, four rows of three). */
const FIRST_TILES = 11;

type When = { date: string; time: string; short: string; full: string };
/** effect: the effects agent makes it (decided at launch; its steps and its time). */
type Work = { postId: string; title: string; quoteId: string; effort: Effort; minutes: string; music: boolean; effect: boolean; picked: Picked };

/** When a local date and time (the studio's) goes out, in her words, against the studio's local now. */
function whenAt(local: string, nowLocal: string): When {
  const w = publishWhen(`${local}:00Z`, "UTC", new Date(`${nowLocal}:00Z`));
  return { date: local.slice(0, 10), time: local.slice(11, 16), short: w.short, full: w.full };
}

/** The first free day (or the day asked for, at her usual hour). */
function defaultWhen(o: NewPostOptions | null, date?: string): When | null {
  if (!o) return null;
  const slot = date ? o.slots.find((s) => s.date === date) : o.slots[0];
  if (slot) return { date: slot.date, time: slot.time, short: slot.short, full: slot.full };
  const tomorrow = new Date(Date.parse(`${o.nowLocal.slice(0, 10)}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return whenAt(`${date ?? tomorrow}T${o.slots[0]?.time ?? "18:00"}`, o.nowLocal);
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

export function NewPostSheet({ date, onClose }: { date?: string; timezone: string; onClose: () => void }) {
  const titleId = useId();
  const [options, setOptions] = useState<NewPostOptions | null>(null);
  const [work, setWork] = useState<Work | null>(null);

  // Her library, free days and ideas, loaded once when the sheet opens.
  useEffect(() => {
    let live = true;
    newPostOptions()
      .then((o) => live && o && setOptions(o))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={onClose} className="fauve-fade absolute inset-0 bg-ink/35" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fauve-enter relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-[min(860px,92dvh)] sm:max-w-[560px] sm:rounded-[22px] sm:shadow-[0_24px_60px_rgba(28,21,48,0.22)]"
      >
        {work ? (
          <Working work={work} titleId={titleId} onClose={onClose} />
        ) : (
          <Create date={date} options={options} titleId={titleId} onClose={onClose} onStarted={setWork} />
        )}
      </div>
    </div>
  );
}

function Create({
  date,
  options,
  titleId,
  onClose,
  onStarted,
}: {
  date?: string;
  options: NewPostOptions | null;
  titleId: string;
  onClose: () => void;
  onStarted: (work: Work) => void;
}) {
  const router = useRouter();
  const openFauve = useFauveDrawer();
  const handOff = useContext(NewPostHandOffContext);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<"subscribe" | "credits" | null>(null);
  const uploads = useChatUploads(options?.studioId ?? null, setError);
  /** Picked, in order: « m:<media id> » from her library, « u:<draft id> » from her phone. */
  const [order, setOrder] = useState<string[]>([]);
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<PostKind | null>(null);
  const [when, setWhen] = useState<When | null>(null);
  const [other, setOther] = useState("");
  /** Her choices, else the studio's (voice) and the usual places (platforms). */
  const [voice, setVoice] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[] | null>(null);
  /** Made like the Reel she sent Simone to copy (« Steal »), when there is one: yes unless she says otherwise. */
  const [copyOn, setCopyOn] = useState(true);
  const [sheet, setSheet] = useState<"format" | "date" | "voice" | "copy" | "nothing" | null>(null);
  const [all, setAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // Escape closes a small sheet before the whole screen.
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setSheet(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sheet]);

  // The previews of her new files are freed when the screen goes.
  const filesRef = useRef<DraftFile[]>([]);
  useEffect(() => {
    filesRef.current = uploads.files;
  }, [uploads.files]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const library = options?.media ?? [];
  const drafts = new Map(uploads.files.map((f) => [f.id, f]));
  const videoOf = new Map(library.map((m) => [m.id, m.video]));
  const picked = order.filter((k) => (k.startsWith("u:") ? drafts.has(k.slice(2)) : videoOf.has(k.slice(2))));
  const counts: Picked = picked.reduce(
    (c, k) => ((k.startsWith("u:") ? drafts.get(k.slice(2))?.video : videoOf.get(k.slice(2))) ? { ...c, videos: c.videos + 1 } : { ...c, photos: c.photos + 1 }),
    { videos: 0, photos: 0 },
  );
  const advised = advisedFormat(counts);
  const kind = format && !formatBlocked(format, counts) ? format : advised;
  const meta = FORMATS.find((f) => f.kind === kind)!;
  const chosenWhen = when ?? defaultWhen(options, date);
  const chosenVoice = voice ?? defaultVoice(options);
  const copying = kind === "reel" && Boolean(options?.copy) && copyOn;
  // TikTok only takes videos (a Reel here), and only once it is connected.
  const places = (platforms ?? (kind === "reel" && options?.tiktok ? ["instagram", "tiktok"] : ["instagram"])).filter(
    (p) => p === "instagram" || (p === "tiktok" && kind === "reel" && options?.tiktok),
  );
  const where = places.length ? places : ["instagram"];
  const sending = picked.some((k) => k.startsWith("u:") && drafts.get(k.slice(2))?.status === "uploading");
  const broken = picked.some((k) => k.startsWith("u:") && drafts.get(k.slice(2))?.status === "error");
  const ready = picked.length > 0 && Boolean(chosenWhen) && !sending && !broken;

  const toggle = (key: string) => setOrder((o) => (o.includes(key) ? o.filter((k) => k !== key) : picked.length >= MAX_FILES ? o : [...o, key]));
  const add = (list: FileList | File[]) => {
    setError(null);
    // New files are picked too, as long as there is room (10 at most).
    const ids = uploads.addFiles(list).slice(0, Math.max(0, MAX_FILES - picked.length));
    if (ids.length) setOrder((o) => [...o, ...ids.map((id) => `u:${id}`)]);
  };
  const remove = (id: string) => {
    uploads.removeFile(id);
    setOrder((o) => o.filter((k) => k !== `u:${id}`));
  };

  const launch = () =>
    start(async () => {
      if (!chosenWhen || !picked.length) return;
      setError(null);
      setLocked(null);
      const items = picked.flatMap((k): ({ media: string } | { upload: { path: string; mime: string; size: number } })[] => {
        if (k.startsWith("m:")) return [{ media: k.slice(2) }];
        const f = drafts.get(k.slice(2));
        return f?.path ? [{ upload: { path: f.path, mime: f.file.type, size: f.file.size } }] : [];
      });
      const res = await launchCreation({
        kind,
        date: chosenWhen.date,
        time: chosenWhen.time,
        idea,
        items,
        voice: kind === "reel" ? chosenVoice : "auto",
        platforms: where.filter((p): p is "instagram" | "tiktok" => p === "instagram" || p === "tiktok"),
        copy: copying,
      }).catch(
        (): LaunchResult => ({ ok: false, error: "Ça n’est pas parti. Réessaie dans un instant." }),
      );
      if (!res.ok) {
        setError(res.error);
        setLocked(res.locked ?? null);
        if (res.postId) router.refresh();
        return;
      }
      router.refresh();
      if (res.montage) {
        nudgeWork();
        onStarted({ postId: res.postId, title: res.title, ...res.montage, picked: counts });
        return;
      }
      // A carousel, a photo or a story: Simone writes the texts, in the chat.
      const text = [
        `Nouvelle publication : ${meta.phrase} pour ${chosenWhen.full.charAt(0).toLowerCase()}${chosenWhen.full.slice(1)}.`,
        idea.trim() ? `Ce que j’imagine : ${idea.trim()}` : "",
        `${counts.videos ? "Mes photos et vidéos" : "Mes photos"} (media_id, dans l’ordre) : ${res.mediaIds.join(", ")}.`,
        "Choisis toi-même la mise en page et les textes, et lance-toi : je regarde le résultat après.",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (handOff) handOff({ postId: res.postId, text, files: [] });
      else openFauve({ postId: res.postId, title: res.title, start: { text, files: [] } });
      onClose();
    });

  const shownLibrary = all ? library : library.slice(0, Math.max(0, FIRST_TILES - uploads.files.length));
  const ideas = (options?.ideas[kind] ?? []).slice(0, 4);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between px-2 pt-2.5 pb-1">
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-soft">
          <XIcon size={22} />
        </button>
        <h2 id={titleId} className="text-[16px] font-bold">
          Nouvelle publication
        </h2>
        <span className="size-11" aria-hidden />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-5 pt-1.5 pb-6">
        <div className="flex items-end gap-2.5">
          <Mascot size={46} still />
          <p className="rounded-[20px_20px_20px_6px] bg-[#F3EEF8] px-[15px] py-3 text-[15.5px] leading-[1.4] font-medium">
            Donne-moi tes photos ou vidéos, je m’occupe de tout le reste.
          </p>
        </div>

        <section
          aria-labelledby={`${titleId}-files`}
          className={`flex flex-col gap-2.5 rounded-[18px] transition-colors ${dragging ? "bg-violet-soft outline-2 outline-offset-4 outline-violet outline-dashed" : ""}`}
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
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 id={`${titleId}-files`} className="text-[17px] font-extrabold tracking-[-0.01em]">
              Tes photos et vidéos
            </h3>
            <span className="text-[13px] font-semibold text-muted">
              {picked.length === 0 ? "Touche pour choisir" : picked.length === 1 ? "1 choisie" : `${picked.length} choisies`}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <li>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!options}
                className="fauve-press flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed border-[#CFC6F7] bg-[#F6F2FF] p-1.5 text-violet disabled:opacity-60"
              >
                <PlusIcon size={24} />
                <span className="text-center text-[12.5px] leading-tight font-bold">
                  <span className="sm:hidden">Depuis ton téléphone</span>
                  <span className="max-sm:hidden">Depuis ton ordinateur</span>
                </span>
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
            </li>
            {uploads.files.map((f) => {
              const at = picked.indexOf(`u:${f.id}`);
              return (
                <li key={f.id} className="relative">
                  <Tile
                    on={at >= 0}
                    order={at + 1}
                    label={`${f.video ? "Vidéo" : "Photo"} envoyée depuis ton appareil`}
                    onClick={() => toggle(`u:${f.id}`)}
                    media={f.video ? <video src={f.preview} muted playsInline preload="metadata" className="size-full object-cover" /> : <Img src={f.preview} />}
                    badge={f.video ? <PlayIcon size={10} /> : null}
                  >
                    {f.status !== "ready" && (
                      <span className={`absolute inset-0 flex items-center justify-center text-[12px] font-bold text-white ${f.status === "error" ? "bg-danger/70" : "bg-ink/45"}`}>
                        {f.status === "error" ? "Pas envoyée" : <Spinner />}
                      </span>
                    )}
                  </Tile>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    aria-label="Retirer ce fichier"
                    className="absolute top-[7px] left-[7px] flex size-6 items-center justify-center rounded-full bg-ink/60 text-white hover:bg-ink/80"
                  >
                    <XIcon size={12} />
                  </button>
                </li>
              );
            })}
            {options === null
              ? Array.from({ length: 5 }, (_, i) => <li key={i} className="aspect-square animate-pulse rounded-[16px] bg-soft" aria-hidden />)
              : shownLibrary.map((m) => {
                  const at = picked.indexOf(`m:${m.id}`);
                  return (
                    <li key={m.id}>
                      <Tile
                        on={at >= 0}
                        order={at + 1}
                        label={`${m.video ? "Vidéo" : "Photo"} du ${new Date(m.at).toLocaleDateString("fr-FR")}`}
                        onClick={() => toggle(`m:${m.id}`)}
                        media={m.video ? <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" /> : <Img src={m.url} />}
                        badge={
                          m.video ? (
                            <>
                              <PlayIcon size={10} />
                              {m.duration ? clock(m.duration) : null}
                            </>
                          ) : null
                        }
                      />
                    </li>
                  );
                })}
          </ul>
          {!all && library.length > shownLibrary.length && (
            <button type="button" onClick={() => setAll(true)} className="self-start text-[14px] font-bold text-violet">
              Voir toute ta médiathèque ({library.length})
            </button>
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <label htmlFor={`${titleId}-idea`} className="text-[17px] font-extrabold tracking-[-0.01em]">
            Ce que tu imagines <span className="text-[13px] font-semibold tracking-normal text-muted">facultatif</span>
          </label>
          <p className="-mt-1 text-[13.5px] leading-snug text-muted">Par quoi commencer, comment finir, ce que les gens doivent faire. Avec une voix, ou juste un message à l’écran.</p>
          <textarea
            id={`${titleId}-idea`}
            value={idea}
            maxLength={500}
            rows={3}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={SCENARIO_EXAMPLE[kind]}
            className="w-full resize-none rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[15.5px] leading-snug outline-none focus:border-violet"
          />
          {/* Ideas only while she has written nothing: a tap fills in a whole example request, which she then edits. */}
          {ideas.length > 0 && !idea.trim() && (
            <div className="flex flex-wrap gap-1.5" aria-label="Exemples de demandes">
              {ideas.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  onClick={() => setIdea(it.prompt)}
                  className="fauve-press h-[34px] rounded-full border border-line bg-soft px-[13px] text-[13.5px] font-semibold hover:border-violet/40"
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-[16px] bg-peach px-4 py-3 text-[14px] leading-snug text-peach-ink">
            <p className="font-semibold">{error}</p>
            {locked && (
              <Link href="/abonnement" onClick={onClose} className="self-start font-bold underline underline-offset-2">
                {locked === "subscribe" ? "Démarrer mon essai" : "Voir mon abonnement"}
              </Link>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-col items-stretch gap-1 border-t border-line bg-white px-5 pt-3 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
        {/* What Simone will do, right above the button that does it: each line opens its choice. */}
        {picked.length > 0 && chosenWhen && (
          <div aria-live="polite" className="fauve-enter grid grid-cols-2 gap-2 pb-2">
            <Field wide={kind !== "reel"} icon={<meta.Icon size={17} />} label="Format" value={meta.title} onClick={() => setSheet("format")} />
            {kind === "reel" && <Field icon={<MicIcon size={17} />} label="Voix off" value={voiceLabel(chosenVoice)} onClick={() => setSheet("voice")} />}
            {kind === "reel" && options?.copy && (
              <Field
                wide
                icon={<PaletteIcon size={17} />}
                label="Style"
                value={copying ? "Comme le Reel que tu m’as envoyé" : "Ton style"}
                sub={copying ? (options.copy.name ?? undefined) : undefined}
                onClick={() => setSheet("copy")}
              />
            )}
            <Field wide icon={<CalendarIcon size={17} />} label="Quand et où" value={chosenWhen.full} sub={placeLabel(where)} onClick={() => setSheet("date")} />
          </div>
        )}
        <button
          type="button"
          onClick={launch}
          disabled={!ready || pending}
          className="btn btn-primary h-[54px] text-[17px] font-extrabold shadow-[0_8px_22px_rgba(91,63,217,0.28)] disabled:bg-line disabled:text-muted disabled:shadow-none"
        >
          {pending ? <Spinner /> : null}
          {pending ? "C’est parti…" : "C’est parti"}
        </button>
        {!picked.length ? (
          <>
            <p className="text-center text-[13px] text-muted">Choisis au moins une photo ou une vidéo.</p>
            <button type="button" onClick={() => setSheet("nothing")} className="h-10 text-[14.5px] font-bold text-violet">
              Je n’ai rien sous la main
            </button>
          </>
        ) : sending ? (
          <p className="pt-1 text-center text-[13px] text-muted">J’envoie tes fichiers…</p>
        ) : broken ? (
          <p className="pt-1 text-center text-[13px] text-danger">Un fichier n’est pas passé : retire-le ou ajoute-le à nouveau.</p>
        ) : (
          <p className="pt-1 text-center text-[12.5px] leading-snug text-muted">
            {kind === "reel" ? "Le style, les textes et la musique, je les choisis." : "La mise en page et les textes, je les choisis."} Tu pourras tout changer après.
          </p>
        )}
      </footer>

      {sheet === "format" && (
        <Sheet label="Le format" onClose={() => setSheet(null)}>
          <SheetHead title="Quel format ?" hint={formatWhy(counts)} onClose={() => setSheet(null)} />
          <div role="radiogroup" aria-label="Format" className="flex flex-col gap-2">
            {FORMATS.map((f) => {
              const blocked = formatBlocked(f.kind, counts);
              return (
                <Choice
                  key={f.kind}
                  on={f.kind === kind}
                  disabled={Boolean(blocked)}
                  title={f.title}
                  hint={blocked ?? f.hint}
                  badge={f.kind === advised ? "Conseillé" : null}
                  onClick={() => {
                    setFormat(f.kind);
                    setSheet(null);
                  }}
                />
              );
            })}
          </div>
        </Sheet>
      )}

      {sheet === "date" && options && (
        <Sheet label="La date" onClose={() => setSheet(null)}>
          <SheetHead title="Quand et où le publier ?" hint="Tes prochains jours libres, à ton heure habituelle." onClose={() => setSheet(null)} />
          {kind === "reel" && options.tiktok && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[14px] font-bold">Où ?</span>
              {(["instagram", "tiktok"] as const).map((p) => {
                const on = where.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlatforms(on ? (where.length > 1 ? where.filter((x) => x !== p) : where) : [...where, p])}
                    className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-bold ${on ? "border-violet bg-violet-soft text-violet" : "border-line bg-white text-muted"}`}
                  >
                    {p === "instagram" ? "Instagram" : "TikTok"}
                  </button>
                );
              })}
            </div>
          )}
          <div role="radiogroup" aria-label="Date" className="flex flex-col gap-2">
            {options.slots.map((s, i) => (
              <Choice
                key={s.iso}
                on={chosenWhen?.date === s.date && chosenWhen.time === s.time}
                title={s.full}
                hint={i === 0 ? "Le prochain jour libre" : null}
                onClick={() => {
                  setWhen({ date: s.date, time: s.time, short: s.short, full: s.full });
                  setSheet(null);
                }}
              />
            ))}
            <label className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-line px-3.5 py-3">
              <span className="text-[15px] font-bold text-violet">Une autre date</span>
              <input
                type="datetime-local"
                value={other}
                min={options.nowLocal}
                onChange={(e) => setOther(e.target.value)}
                className="h-11 rounded-[12px] border border-line bg-white px-3 text-[15px] outline-none focus:border-violet"
              />
            </label>
            {other && (
              <button
                type="button"
                disabled={other <= options.nowLocal}
                onClick={() => {
                  setWhen(whenAt(other.slice(0, 16), options.nowLocal));
                  setSheet(null);
                }}
                className="btn btn-primary h-12 disabled:bg-line disabled:text-muted"
              >
                {other <= options.nowLocal ? "Choisis un moment à venir" : `Le publier ${whenAt(other.slice(0, 16), options.nowLocal).short}`}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet === "voice" && (
        <Sheet label="La voix off" onClose={() => setSheet(null)}>
          <SheetHead title="Une voix off ?" hint="Une voix raconte ton Reel, la musique passe dessous. Écoute et choisis." onClose={() => setSheet(null)} />
          <VoicePicker
            value={chosenVoice}
            onPick={(v) => {
              setVoice(v);
              setSheet(null);
            }}
          />
        </Sheet>
      )}

      {sheet === "copy" && options?.copy && (
        <Sheet label="Le style" onClose={() => setSheet(null)}>
          <SheetHead
            title="Comme le Reel que tu m’as envoyé ?"
            hint="Je reprends sa façon de faire (le rythme, les textes, la lumière) pour ce Reel seulement, avec tes couleurs, tes polices et tes images."
            onClose={() => setSheet(null)}
          />
          <div role="radiogroup" aria-label="Le style" className="flex flex-col gap-2">
            <Choice
              on={copyOn}
              title="Comme le Reel envoyé"
              hint={options.copy.name ? `« ${options.copy.name} »` : "Je le regarde encore"}
              onClick={() => {
                setCopyOn(true);
                setSheet(null);
              }}
            />
            <Choice
              on={!copyOn}
              title="Mon style"
              hint="Ma charte, comme d’habitude"
              onClick={() => {
                setCopyOn(false);
                setSheet(null);
              }}
            />
          </div>
        </Sheet>
      )}

      {sheet === "nothing" && (
        <Sheet label="Des idées à filmer" onClose={() => setSheet(null)}>
          <div className="flex items-center gap-3">
            <Mascot size={52} mood="happy" still />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h3 className="text-[20px] font-extrabold tracking-[-0.01em]">Pas de souci</h3>
              <p className="text-[14px] leading-[1.4] text-muted">3 idées faciles pour cette semaine. 10 secondes de vidéo suffisent.</p>
            </div>
          </div>
          <ol className="flex flex-col gap-2">
            {(options?.film ?? []).map((f, i) => (
              <li key={f.idea} className="flex gap-3 rounded-[18px] bg-soft px-3.5 py-3">
                <span className="w-[18px] font-serif text-[26px] leading-none text-coral italic" aria-hidden>
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold">{f.idea}</span>
                  <span className="text-[13.5px] text-muted">{f.how}</span>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={onClose} className="btn btn-primary h-[52px] text-[16px] font-extrabold">
            Je filme et je reviens
          </button>
          <Link href="/fauve" onClick={onClose} className="self-center py-2 text-[14px] font-bold text-violet">
            Ou demande une idée à Simone
          </Link>
        </Sheet>
      )}
    </>
  );
}

/** « Je m'en occupe »: the Reel in the making, step by step, until it is ready. */
function Working({ work, titleId, onClose }: { work: Work; titleId: string; onClose: () => void }) {
  const router = useRouter();
  const openFauve = useFauveDrawer();
  const handOff = useContext(NewPostHandOffContext);
  const [progress, setProgress] = useState<CreationProgress | null>(null);
  // The effects agent makes the Reel (decided at launch, or once it takes it): its own steps, and its own time.
  const effect = work.effect || Boolean(progress?.effect);
  const steps = creationSteps(work.effort, work.picked, work.music, effect);
  /** The furthest step reached: a correction renders again, the list never steps back. */
  const [reached, setReached] = useState(0);
  const done = progress?.done ?? false;
  const failed = progress?.failed ?? false;

  useEffect(() => {
    if (done || failed) return;
    let live = true;
    const tick = () =>
      creationProgress(work.quoteId, work.postId)
        .then((p) => {
          if (!live || !p) return;
          setProgress(p);
          const phases = creationSteps(work.effort, work.picked, work.music, work.effect || p.effect).map((s) => s.phase);
          setReached((r) => Math.max(r, phases.indexOf(p.phase)));
          if (p.done) router.refresh();
        })
        .catch(() => {});
    void tick();
    const timer = setInterval(tick, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [done, failed, work, router]);

  const retry = () => {
    const text = "Le montage de ce Reel n’a pas abouti. Tu peux réessayer ?";
    if (handOff) handOff({ postId: work.postId, text, files: [] });
    else openFauve({ postId: work.postId, title: work.title, start: { text, files: [] } });
    onClose();
  };

  return (
    <>
      <header className="flex shrink-0 justify-end px-2 pt-2.5">
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-soft">
          <XIcon size={22} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-[18px] overflow-y-auto px-6 pt-4 pb-4 text-center">
        <Mascot size={128} mood={failed ? "sad" : done ? "happy" : "thinking"} />
        <div aria-live="polite" className="flex flex-col items-center gap-1.5">
          <h2 id={titleId} className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em]">
            {failed ? (
              <>
                Ça n’a pas <span className="accent text-[38px]">marché</span>
              </>
            ) : done ? (
              <>
                C’est <span className="accent text-[38px]">prêt</span> !
              </>
            ) : (
              <>
                Je m’en <span className="accent text-[38px]">occupe</span>
              </>
            )}
          </h2>
          <p className="text-[16px] leading-[1.45] text-muted">
            {failed
              ? "Aucun crédit n’a été débité. Simone peut réessayer."
              : done
                ? progress?.seconds
                  ? `Ton Reel de ${progress.seconds} secondes t’attend.`
                  : "Ton Reel t’attend."
                : `Ton Reel sera prêt dans ${effect ? EFFECT_MINUTES : work.minutes} minutes environ.`}
          </p>
        </div>
        <ol aria-label="Ce que fait Simone" className="flex w-full flex-col rounded-[22px] border border-line bg-white px-[18px] py-2 text-left">
          {steps.map((s, i) => {
            const state = done || i < reached ? "done" : i === reached && !failed ? "now" : "later";
            return (
              <li key={s.phase} className="flex min-h-12 items-center gap-3">
                {state === "done" ? (
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-violet text-white">
                    <CheckIcon size={14} />
                  </span>
                ) : state === "now" ? (
                  <span className="flex size-[26px] shrink-0 items-center justify-center text-violet">
                    <Spinner />
                  </span>
                ) : (
                  <span className="size-[26px] shrink-0 rounded-full border-2 border-line" />
                )}
                <span className={`text-[15.5px] ${state === "now" ? "font-extrabold" : state === "done" ? "font-semibold" : "font-medium text-muted"}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        {!done && !failed && (
          <div className="flex w-full items-start gap-3 rounded-[20px] bg-soft px-4 py-3.5 text-left">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckIcon size={18} />
            </span>
            <p className="text-[14.5px] leading-[1.45]">
              <strong className="font-extrabold">Tu peux fermer l’app.</strong> Je te préviens dès que c’est prêt.
            </p>
          </div>
        )}
      </div>
      <footer className="flex shrink-0 flex-col gap-1.5 px-5 pt-3 pb-[max(1.4rem,env(safe-area-inset-bottom))]">
        {done ? (
          <Link href={`/publications/${work.postId}`} onClick={onClose} className="fauve-enter btn btn-primary h-[54px] text-[17px] font-extrabold shadow-[0_8px_22px_rgba(91,63,217,0.28)]">
            Voir mon Reel
          </Link>
        ) : failed ? (
          <button type="button" onClick={retry} className="btn btn-primary h-[54px] text-[17px] font-extrabold">
            Demander à Simone de réessayer
          </button>
        ) : (
          <button type="button" onClick={onClose} className="btn btn-secondary h-[54px] text-[16.5px] font-extrabold">
            OK, préviens-moi
          </button>
        )}
      </footer>
    </>
  );
}

/** One line of what Simone will do (format, voice, when and where): obviously a choice to open. */
function Field({ icon, label, value, sub, wide, onClick }: { icon: ReactNode; label: string; value: string; sub?: string; wide?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`fauve-press flex min-w-0 items-center gap-2.5 rounded-[16px] border-[1.5px] border-line bg-white py-2 pr-2.5 pl-2 text-left transition-colors hover:border-violet/40 ${wide ? "col-span-2" : "max-[419px]:pl-3.5"}`}
    >
      {/* Half a narrow phone: the words first. */}
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet ${wide ? "" : "max-[419px]:hidden"}`}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11.5px] font-semibold text-muted">{label}</span>
        <span className="truncate text-[14.5px] leading-tight font-extrabold">{value}</span>
        {sub && <span className="truncate text-[12.5px] text-muted">{sub}</span>}
      </span>
      <span className="shrink-0 text-muted">
        <ChevronRightIcon size={16} />
      </span>
    </button>
  );
}

/** « Simone choisit », without, or one of her voices (each to listen to first). */
function VoicePicker({ value, onPick }: { value: string; onPick: (voice: string) => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const listen = (id: string) => {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const sample = new Audio(`${SAMPLES}/${voiceSamplePath(id)}`);
    audio.current = sample;
    sample.onended = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    sample.play().catch(() => setPlaying(null));
  };
  const pick = (v: string) => {
    audio.current?.pause();
    onPick(v);
  };
  return (
    <div role="radiogroup" aria-label="La voix off" className="flex flex-col gap-2">
      <Choice on={value === "auto"} title="Simone choisit" hint="Une voix quand personne ne parle dans tes vidéos" onClick={() => pick("auto")} />
      <Choice on={value === "off"} title="Sans voix off" hint="Juste la musique" onClick={() => pick("off")} />
      <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
        {SIMONE_VOICES.map((v) => {
          const on = value === v.id;
          return (
            <div key={v.id} className={`flex items-center gap-1.5 rounded-[14px] border-[1.5px] py-1 pr-1 pl-3 ${on ? "border-violet bg-violet-tint" : "border-line bg-white"}`}>
              <button type="button" role="radio" aria-checked={on} onClick={() => pick(v.id)} className="flex min-w-0 flex-1 flex-col py-1.5 text-left">
                <span className="text-[14.5px] font-extrabold">{v.name}</span>
                <span className="truncate text-[12.5px] text-muted">{`${v.hint.charAt(0).toUpperCase()}${v.hint.slice(1)}`}</span>
              </button>
              <button
                type="button"
                onClick={() => listen(v.id)}
                aria-label={playing === v.id ? `Arrêter ${v.name}` : `Écouter ${v.name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-ink hover:bg-violet-tint"
              >
                {playing === v.id ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A photo or video to pick: its number in the order once picked. */
function Tile({ on, order, label, onClick, media, badge, children }: { on: boolean; order: number; label: string; onClick: () => void; media: ReactNode; badge: ReactNode; children?: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick} className="relative block aspect-square w-full overflow-hidden rounded-[16px] bg-line">
      {media}
      {badge && (
        <span className="absolute bottom-[7px] left-[7px] flex items-center gap-[3px] rounded-full bg-ink/60 py-[3px] pr-[7px] pl-[5px] text-[11.5px] font-bold text-white">{badge}</span>
      )}
      {on && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[16px] ring-3 ring-violet ring-inset" />}
      <span
        aria-hidden
        className={`absolute top-[7px] right-[7px] flex size-[26px] items-center justify-center rounded-full border-2 border-white text-[13px] font-extrabold ${on ? "fauve-pop bg-violet text-white" : "bg-ink/20"}`}
      >
        {on ? order : ""}
      </span>
      {children}
    </button>
  );
}

function Img({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className="size-full object-cover" />;
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 animate-spin motion-reduce:animate-none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A small sheet over the screen (format, date, ideas to film). */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <button type="button" aria-label="Fermer" onClick={onClose} className="fauve-fade absolute inset-0 z-10 bg-ink/40" />
      <div
        role="dialog"
        aria-label={label}
        className="fauve-enter absolute inset-x-0 bottom-0 z-20 flex max-h-[88%] flex-col gap-3.5 overflow-y-auto rounded-t-[26px] bg-white px-5 pt-2.5 pb-[max(1.6rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(28,21,48,0.14)] [--fauve-y:40px]"
      >
        <span aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-line" />
        {children}
      </div>
    </>
  );
}

function SheetHead({ title, hint, onClose }: { title: string; hint: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-[20px] font-extrabold tracking-[-0.01em]">{title}</h3>
        <p className="text-[14px] leading-[1.45] text-muted">{hint}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F3F1F5] text-ink">
        <XIcon size={16} />
      </button>
    </div>
  );
}

function Choice({ on, disabled, title, hint, badge, onClick }: { on: boolean; disabled?: boolean; title: string; hint: string | null; badge?: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`fauve-press flex items-center gap-3 rounded-[18px] border-[1.5px] px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-violet bg-[#F6F2FF]" : "border-line bg-white hover:border-violet/40"}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[16px] font-extrabold">
          {title}
          {badge && <span className="rounded-full bg-peach px-2 py-0.5 text-[11.5px] font-bold text-peach-ink">{badge}</span>}
        </span>
        {hint && <span className="text-[13.5px] text-muted">{hint}</span>}
      </span>
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-violet" : "border-[#CFC6F7]"}`}>
        {on && <span className="size-3 rounded-full bg-violet" />}
      </span>
    </button>
  );
}
