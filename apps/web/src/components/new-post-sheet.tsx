"use client";

import {
  advisedFormat,
  creationSteps,
  EFFECT_MINUTES,
  findVoice,
  formatBlocked,
  formatWhy,
  imagineQuestion,
  publishWhen,
  queuedLine,
  reelLink,
  SIMONE_VOICES,
  validatedPlanBrief,
  voiceSamplePath,
  type Effort,
  type Picked,
  type PostKind,
  type PostPlan,
} from "@fauve/agent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { creationProgress, launchCreation, type CreationProgress, type LaunchResult } from "@/app/(app)/create-actions";
import { FileStrip, MAX_FILE_BYTES, MAX_FILES, useChatUploads, type DraftFile } from "@/app/(app)/fauve/chat-uploads";
import { copyReel, copyState, newPostOptions, proposePlan, type CopyState, type NewPostOptions } from "@/app/(app)/new-post-actions";
import { useFauveDrawer } from "./fauve-drawer";
import { publicEnv } from "@/lib/public-env";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ArrowLeftIcon, CalendarIcon, CheckIcon, ChevronRightIcon, FilmIcon, ImageIcon, LayersIcon, PauseIcon, PlayIcon, PlusIcon, XIcon } from "./icons";
import { Mascot } from "./mascot";
import { nudgeWork } from "./work-pill";

/** Where a carousel, a photo or a story goes on: by default Edith's panel; on the Edith page, its own conversation. */
export type NewPostHandOff = (start: { postId: string; text: string; files: File[] }) => void;
export const NewPostHandOffContext = createContext<NewPostHandOff | null>(null);

// « Nouvelle publication », in four steps (Tristan : « trop d'étapes », « écrans vides ») :
// what to make (the type, and for a Reel a voice or just the music, on one screen), her photos and videos (her library or her phone), what she imagines or a Reel she
// likes, then Edith's proposal: her request said back as one plan in points, with why
// (« la demande bien reformulée, claire et précise, lisible »), which she takes or changes.
// « C'est parti »: a Reel starts at once and the screen follows it (« Je m'en occupe »);
// a carousel, a photo or a story goes on with Edith in the chat, who writes the texts.

type Step = "what" | "files" | "idea" | "proposal";
const STEP_LABELS: Record<Step, string> = { what: "Le format", files: "Tes fichiers", idea: "Ton idée", proposal: "La proposition" };

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

/** Her studio's voice setting (Style), as the first choice: « Edith choisit », without, or its voice. */
function defaultVoice(o: NewPostOptions | null): string {
  if (!o || o.voice.use === "auto") return "auto";
  if (o.voice.use === "never") return "off";
  return knownVoice(o, o.voice.voiceId) ? o.voice.voiceId! : SIMONE_VOICES[0]!.id;
}

/** One of Edith's voices, or her own (her clone). */
const knownVoice = (o: NewPostOptions, id: string | null) => Boolean(id && (findVoice(id) || id === o.ownVoice?.id));

/** « Une voix off » chosen: the studio's voice (Style), else Edith's first. */
function studioVoice(o: NewPostOptions): string {
  return knownVoice(o, o.voice.voiceId) ? o.voice.voiceId! : SIMONE_VOICES[0]!.id;
}

/** Under « Voix off »: « À choisir » until she answers, « Edith choisit », « Aucune », « Eva ». */
function voiceLabel(voice: string, asked: boolean): string {
  if (!asked) return "Avec ou sans ?";
  if (voice === "auto") return "Edith choisit";
  if (voice === "off") return "Aucune";
  return findVoice(voice)?.name ?? "Edith choisit";
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

/** `copyLink`: a Reel to make one like (from the page Tendances), read as the Reel she copies. */
export function NewPostSheet({ date, copyLink, onClose }: { date?: string; copyLink?: string; timezone: string; onClose: () => void }) {
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
        className="fauve-enter relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(860px,92dvh)] sm:min-h-[min(520px,92dvh)] sm:max-w-[560px] sm:rounded-[22px] sm:shadow-[0_24px_60px_rgba(28,21,48,0.22)]"
      >
        {work ? (
          <Working work={work} titleId={titleId} onClose={onClose} />
        ) : (
          <Create date={date} copyLink={copyLink} options={options} titleId={titleId} onClose={onClose} onStarted={setWork} />
        )}
      </div>
    </div>
  );
}

function Create({
  date,
  copyLink,
  options,
  titleId,
  onClose,
  onStarted,
}: {
  date?: string;
  copyLink?: string;
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
  // A carousel or a post she likes, as captures: its form for Edith, never its words (a link of a carousel does not open).
  const refs = useChatUploads(options?.studioId ?? null, setError);
  const refRef = useRef<HTMLInputElement>(null);
  /** Picked, in order: « m:<media id> » from her library, « u:<draft id> » from her phone. */
  const [order, setOrder] = useState<string[]>([]);
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<PostKind | null>(copyLink ? "reel" : null);
  const [when, setWhen] = useState<When | null>(null);
  const [other, setOther] = useState("");
  /** Her choices, else the studio's (voice) and the usual places (platforms). */
  const [voice, setVoice] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[] | null>(null);
  /** Made like a Reel she likes (« Steal »): one she gives here, else the one she sent Edith (followed unless she says otherwise). */
  const [given, setGiven] = useState<string | null>(null);
  const [copyChoice, setCopyChoice] = useState<"mine" | "copy" | null>(null);
  const [copyRead, setCopyRead] = useState<CopyState | null>(null);
  const [sheet, setSheet] = useState<"format" | "date" | "voice" | "nothing" | null>(null);
  const [all, setAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);

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
  // The type comes before her files (Tristan's order): what she picks stays, checked against her files at the Photos step.
  const kind = format ?? advised;
  const unfit = picked.length ? formatBlocked(kind, counts) : null;
  const meta = FORMATS.find((f) => f.kind === kind)!;
  const chosenWhen = when ?? defaultWhen(options, date);
  const chosenVoice = voice ?? defaultVoice(options);
  // With or without a voice over: always asked for a Reel (Tristan: « il faut demander si voix off ou pas »),
  // unless her Style already says always or never.
  const voiceAsked = voice !== null || (options?.voice.use ?? "auto") !== "auto";
  const [launchOnVoice, setLaunchOnVoice] = useState(false);
  const sent = options?.copy ?? null;
  const model = given ?? sent?.id ?? null;
  // Its reading: the one she sent Edith comes read (or still being read); one given here is followed below.
  const reading: CopyState | null = copyRead ?? (sent && model === sent.id ? (sent.lines.length ? { state: "read", name: sent.name, lines: sent.lines } : { state: "reading" }) : null);
  // A Reel that could not be read copies nothing: her own style, and the sheet says what to send instead.
  const usable = model && reading?.state !== "missed" ? model : null;
  const copying = kind === "reel" && usable && (copyChoice ?? (sent ? "copy" : "mine")) === "copy" ? usable : null;
  // One of her own Reels kept as a model (« Garder comme modèle »): already read, never one shot.
  const models = options?.models ?? [];
  const pickModel = (m: (typeof models)[number]) => {
    setGiven(m.id);
    setCopyRead({ state: "read", name: m.name, lines: m.lines });
    setCopyChoice("copy");
  };
  // Its reading followed until it is done (about a minute): what her Reel takes from it, or why not.
  const waiting = model && reading?.state !== "read" && reading?.state !== "missed" ? model : null;
  useEffect(() => {
    if (!waiting) return;
    let live = true;
    const tick = () =>
      copyState(waiting)
        .then((r) => {
          if (live && r && r.state !== "reading") setCopyRead(r);
        })
        .catch(() => {});
    void tick();
    const timer = setInterval(tick, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [waiting]);
  // TikTok only takes videos (a Reel here), and only once it is connected.
  const places = (platforms ?? (kind === "reel" && options?.tiktok ? ["instagram", "tiktok"] : ["instagram"])).filter(
    (p) => p === "instagram" || (p === "tiktok" && kind === "reel" && options?.tiktok),
  );
  const where = places.length ? places : ["instagram"];
  const sending = picked.some((k) => k.startsWith("u:") && drafts.get(k.slice(2))?.status === "uploading");
  const broken = picked.some((k) => k.startsWith("u:") && drafts.get(k.slice(2))?.status === "error");
  // What she imagines, or a ref: Edith asks before she makes anything (Tristan: « simone part trop vite en production »).
  const refShots = kind === "reel" ? [] : refs.files.filter((f) => f.status === "ready" && f.path);
  const refSending = kind !== "reel" && refs.files.some((f) => f.status === "uploading");
  // A Reel she likes, given on « Ton idée » (its link pasted in what she imagines, or the field below).
  const [linkBusy, setLinkBusy] = useState(Boolean(copyLink));
  const [linkError, setLinkError] = useState<string | null>(null);
  // What she asks for: her own words, and the plan Edith said back for them (« La proposition »).
  const finalIdea = idea.trim();
  // On « Ton idée », what she gave (her words, a Reel to copy, captures): nothing means « propose-moi ».
  const gaveIdea = Boolean(idea.trim()) || Boolean(copying) || refShots.length > 0;

  // One question per screen, in her order (Tristan: « un form avec stepper plutôt que tout dans une modale »);
  // what she imagines or a Reel she likes on its own step, before Edith's proposal (« dans une étape à part entière »).
  const steps: Step[] = ["what", "files", "idea", "proposal"];
  const [stepAt, setStepAt] = useState(0);
  const at = Math.min(stepAt, steps.length - 1);
  const step = steps[at]!;
  const last = at === steps.length - 1;
  const canNext =
    step === "what" ? kind !== "reel" || voiceAsked : step === "files" ? picked.length > 0 && !unfit && !sending && !broken : step === "idea" ? !refSending && !linkBusy : true;
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [at]);
  const next = () => setStepAt(Math.min(at + 1, steps.length - 1));

  // The last step: what Edith would make of the files she picked and of her idea. Asked as soon as
  // they are picked (Tristan : « pas du tout optimisé »: three empty cards on the last step), again
  // when they, her idea, the type, the voice or the Reel she copies change.
  const proposalAsk =
    picked.length && !sending && !broken
      ? JSON.stringify({
          kind,
          ...(idea.trim() ? { idea: idea.trim().slice(0, 500) } : {}),
          files: picked.flatMap((k): ({ media: string } | { upload: { path: string; mime: string; video: boolean } })[] => {
            if (k.startsWith("m:")) return [{ media: k.slice(2) }];
            const f = drafts.get(k.slice(2));
            return f?.path ? [{ upload: { path: f.path, mime: f.file.type, video: f.video } }] : [];
          }),
          ...(kind === "reel"
            ? {
                voice: chosenVoice,
                copying: Boolean(copying),
                ...(copying && reading?.state === "read" ? { copy: { name: reading.name, lines: reading.lines } } : {}),
              }
            : {}),
        })
      : null;
  // While she is still picking or writing, asked once she pauses; on the last step, at once.
  const [settledAsk, setSettledAsk] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledAsk(proposalAsk), step === "proposal" ? 0 : step === "idea" ? 1500 : 900);
    return () => clearTimeout(timer);
  }, [proposalAsk, step]);
  const [proposal, setProposal] = useState<{ ask: string; plan: PostPlan | null } | null>(null);
  const proposing = proposalAsk !== null && proposal?.ask !== proposalAsk;
  // The plan for what she gave now (an older one, for other files or other words, is not hers anymore).
  const plan = !proposing ? (proposal?.plan ?? null) : null;
  const told = Boolean(finalIdea) || Boolean(plan) || Boolean(copying) || refShots.length > 0;
  const ready = picked.length > 0 && !unfit && Boolean(chosenWhen) && !sending && !refSending && !broken && !proposing && told;
  useEffect(() => {
    if (!settledAsk) return;
    let live = true;
    proposePlan(JSON.parse(settledAsk))
      .then((r) => live && setProposal({ ask: settledAsk, ...r }))
      .catch(() => live && setProposal({ ask: settledAsk, plan: null }));
    return () => {
      live = false;
    };
  }, [settledAsk]);

  const followGiven = (id: string) => {
    setGiven(id);
    setCopyRead({ state: "reading" });
    setCopyChoice("copy");
  };
  const typeIdea = (text: string) => {
    const found = kind === "reel" ? reelLink(text) : null;
    if (!found) return setIdea(text);
    // The link becomes the Reel to copy; her words stay what she imagines.
    setIdea(text.replace(/(?:https?:\/\/)?(?:[\w-]+\.)*(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\/\S+/i, "").replace(/\s{2,}/g, " ").trimStart());
    setLinkBusy(true);
    setLinkError(null);
    copyReel({ link: found.url })
      .then((res) => (res.ok ? followGiven(res.id) : setLinkError(res.error)))
      .catch(() => setLinkError("Ce Reel n’est pas passé. Réessaie dans un instant."))
      .finally(() => setLinkBusy(false));
  };

  // A Reel from the page Tendances: a Reel, made like it, as soon as the sheet opens.
  const askedCopy = useRef(false);
  useEffect(() => {
    if (!copyLink || askedCopy.current) return;
    askedCopy.current = true;
    copyReel({ link: copyLink })
      .then((res) => (res.ok ? followGiven(res.id) : setLinkError(res.error)))
      .catch(() => setLinkError("Ce Reel n’est pas passé. Réessaie dans un instant."))
      .finally(() => setLinkBusy(false));
  }, [copyLink]);

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

  const launch = () => {
    if (kind === "reel" && !voiceAsked) {
      setLaunchOnVoice(true);
      setSheet("voice");
      return;
    }
    go(chosenVoice);
  };
  const go = (spoken: string) =>
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
        idea: finalIdea,
        ...(plan ? { plan } : {}),
        items,
        voice: kind === "reel" ? spoken : "auto",
        platforms: where.filter((p): p is "instagram" | "tiktok" => p === "instagram" || p === "tiktok"),
        copy: copying ?? false,
        refs: refShots.map((f) => ({ path: f.path!, mime: f.file.type, size: f.file.size })),
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
      // A carousel, a photo or a story: Edith writes the texts, in the chat.
      const text = [
        `Nouvelle publication : ${meta.phrase} pour ${chosenWhen.full.charAt(0).toLowerCase()}${chosenWhen.full.slice(1)}.`,
        finalIdea ? `Ce que j’imagine : ${finalIdea}` : "",
        plan ? validatedPlanBrief(plan) : "",
        `${counts.videos ? "Mes photos et vidéos" : "Mes photos"} (media_id, dans l’ordre) : ${res.mediaIds.join(", ")}.`,
        res.refIds.length ? `Ma ref, un ${meta.phrase.includes("carrousel") ? "carrousel" : "post"} que j’aime (captures ou vidéo où je le fais défiler ; example_media_ids : suis sa forme, jamais ses mots) : ${res.refIds.join(", ")}.` : "",
        "Choisis toi-même la mise en page et les textes, et lance-toi : je regarde le résultat après.",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (handOff) handOff({ postId: res.postId, text, files: [] });
      else openFauve({ postId: res.postId, title: res.title, start: { text, files: [] } });
      onClose();
    });

  const shownLibrary = all ? library : library.slice(0, Math.max(0, FIRST_TILES - uploads.files.length));

  return (
    <>
      <header className="flex shrink-0 items-center justify-between px-2 pt-2.5 pb-1">
        {at > 0 ? (
          <button type="button" onClick={() => setStepAt(at - 1)} aria-label="Étape d’avant" className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-soft">
            <ArrowLeftIcon size={21} />
          </button>
        ) : (
          <span className="size-11" aria-hidden />
        )}
        <h2 id={titleId} className="text-[16px] font-bold">
          Nouvelle publication
        </h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-soft">
          <XIcon size={22} />
        </button>
      </header>
      {/* Where she is: a step already done can be tapped to go back to it. */}
      <ol aria-label={`Étape ${at + 1} sur ${steps.length}`} className="flex shrink-0 gap-1.5 px-5 pt-1 pb-3">
        {steps.map((s, i) => (
          <li key={s} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={i > at}
              onClick={() => setStepAt(i)}
              aria-current={i === at ? "step" : undefined}
              className="flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
            >
              <span className={`h-1 rounded-full ${i <= at ? "bg-violet" : "bg-line"}`} />
              <span className={`truncate text-[11.5px] font-bold ${i === at ? "text-violet" : i < at ? "text-ink" : "text-muted"}`}>{STEP_LABELS[s]}</span>
            </button>
          </li>
        ))}
      </ol>

      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-5 pt-1.5 pb-6">
        {step === "what" && (
          <div className="flex items-end gap-2.5">
            <Mascot size={46} still />
            <p className="rounded-[20px_20px_20px_6px] bg-[#F3EEF8] px-[15px] py-3 text-[15.5px] leading-[1.4] font-medium">
              Donne-moi tes photos ou vidéos, je m’occupe de tout le reste.
            </p>
          </div>
        )}

        {/* In her order (Tristan): what to make, its style, a voice or just music, her files, then what she imagines. */}
        {step === "what" && (
        <section aria-labelledby={`${titleId}-format`} className="flex flex-col gap-2.5">
          <h3 id={`${titleId}-format`} className="text-[17px] font-extrabold tracking-[-0.01em]">
            Tu veux publier…
          </h3>
          <div role="radiogroup" aria-labelledby={`${titleId}-format`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMATS.map((f) => {
              // Nothing picked yet: every type is open (her files come after).
              const blocked = picked.length ? formatBlocked(f.kind, counts) : null;
              const on = f.kind === kind;
              return (
                <button
                  key={f.kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={Boolean(blocked)}
                  title={blocked ?? f.hint}
                  onClick={() => {
                    setFormat(f.kind);
                    // A Reel asks its style and its voice on the same screen; the others go on to the files.
                    if (f.kind !== "reel") setStepAt(1);
                  }}
                  className={`fauve-press flex h-12 items-center gap-2 rounded-[14px] border-[1.5px] px-3 text-left text-[14.5px] font-extrabold disabled:opacity-40 ${
                    on ? "border-violet bg-violet-tint text-violet" : "border-line bg-white hover:border-violet/40"
                  }`}
                >
                  <f.Icon size={17} />
                  {f.title}
                </button>
              );
            })}
          </div>
        </section>
        )}

        {step === "what" && kind === "reel" && options && (
          <section aria-labelledby={`${titleId}-voice`} className="flex flex-col gap-2.5">
            <h3 id={`${titleId}-voice`} className="text-[17px] font-extrabold tracking-[-0.01em]">
              Une voix off, ou juste la musique ?
            </h3>
            <div role="radiogroup" aria-labelledby={`${titleId}-voice`} className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "on", title: "Une voix off", on: voiceAsked && chosenVoice !== "auto" && chosenVoice !== "off", pick: () => setVoice(chosenVoice !== "auto" && chosenVoice !== "off" ? chosenVoice : studioVoice(options)) },
                  { key: "off", title: "Juste la musique", on: voiceAsked && chosenVoice === "off", pick: () => setVoice("off") },
                  { key: "auto", title: "Edith choisit", on: voiceAsked && chosenVoice === "auto", pick: () => setVoice("auto") },
                ] as const
              ).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={c.on}
                  onClick={c.pick}
                  className={`fauve-press flex min-h-12 items-center justify-center rounded-[14px] border-[1.5px] px-2 py-2 text-center text-[14px] leading-tight font-extrabold ${
                    c.on ? "border-violet bg-violet-tint text-violet" : "border-line bg-white hover:border-violet/40"
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
            {voiceAsked && chosenVoice !== "auto" && chosenVoice !== "off" && (
              <button type="button" onClick={() => setSheet("voice")} className="self-start text-[13.5px] font-bold text-violet">
                {chosenVoice === options?.ownVoice?.id ? "Avec ta voix" : `Avec la voix de ${voiceLabel(chosenVoice, true)}`} · écouter ou changer
              </button>
            )}
          </section>
        )}

        {step === "files" && (
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
        )}

        {step === "idea" && (
        <section className="flex flex-col gap-2.5">
          <label htmlFor={`${titleId}-idea`} className="text-[17px] font-extrabold tracking-[-0.01em]">
            {imagineQuestion(kind)}
          </label>
          <p className="-mt-1 text-[13.5px] leading-snug text-muted">
            {kind === "reel"
              ? "Par quoi commencer, comment finir, ce que les gens doivent faire. Ou colle le lien d’un Reel que tu aimes. Rien en tête ? Passe, je te propose des idées."
              : "Par quoi commencer, comment finir, ce que les gens doivent faire. Rien en tête ? Passe, je te propose des idées."}
          </p>
          <textarea
            ref={ideaRef}
            id={`${titleId}-idea`}
            value={idea}
            maxLength={500}
            rows={4}
            onChange={(e) => typeIdea(e.target.value)}
            placeholder={SCENARIO_EXAMPLE[kind]}
            className="w-full resize-none rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[15.5px] leading-snug outline-none focus:border-violet"
          />
          {linkBusy && (
            <p className="flex items-center gap-2 text-[13.5px] text-muted">
              <Spinner /> J’ouvre ce Reel…
            </p>
          )}
          {linkError && <p className="text-[13px] leading-snug text-danger">{linkError}</p>}
          {/* Or a Reel she likes, one of hers kept as a model, its link or its video: its form, her images. */}
          {kind === "reel" && options && (
            <section aria-labelledby={`${titleId}-style`} className="mt-2 flex flex-col gap-2.5">
              <h3 id={`${titleId}-style`} className="text-[15px] font-extrabold">
                Ou fais-le comme un Reel que tu aimes
              </h3>
              <p className="-mt-1 text-[13.5px] leading-snug text-muted">J’en reprends la façon de faire (le rythme, les textes, la lumière), jamais ses images ni ses mots.</p>
              <div role="radiogroup" aria-label="Le style" className="flex flex-col gap-2">
                <Choice
                  on={!copying}
                  title="Ton style"
                  hint="Tes couleurs, tes polices, ta façon de faire"
                  onClick={() => setCopyChoice("mine")}
                />
                {/* The Reel she sent Edith, still there when she picked another one here. */}
                {sent && given && given !== sent.id && (
                  <Choice
                    on={false}
                    title="Comme le Reel que tu m’as envoyé"
                    hint={sent.name ?? "Je le regarde"}
                    onClick={() => {
                      setGiven(null);
                      setCopyRead(null);
                      setCopyChoice("copy");
                    }}
                  />
                )}
                {usable && !models.some((m) => m.id === usable) && (
                  <Choice
                    on={Boolean(copying)}
                    title={given ? "Comme le Reel que tu aimes" : "Comme le Reel que tu m’as envoyé"}
                    hint={readingLabel(reading)}
                    onClick={() => setCopyChoice("copy")}
                  />
                )}
              </div>
              {models.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-bold">Comme un de tes Reels</span>
                  <div role="radiogroup" aria-label="Comme un de tes Reels" className="flex flex-col gap-2">
                    {models.map((m) => (
                      <Choice key={m.id} on={copying === m.id} title={`Comme ton Reel « ${m.title} »`} hint={`Même rythme, mêmes textes : ${m.name}`} onClick={() => pickModel(m)} />
                    ))}
                  </div>
                </div>
              )}
              {copying && reading?.state === "read" && reading.lines.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-[16px] bg-soft px-3.5 py-3">
                  <span className="text-[13px] font-bold">Ce que ton Reel en reprendra</span>
                  <ul className="flex flex-col gap-1 text-[13.5px] leading-snug text-muted">
                    {reading.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {copying && reading?.state === "reading" && (
                <p className="flex items-center gap-2 text-[13.5px] text-muted">
                  <Spinner /> Je le regarde, environ une minute. Tu peux lancer ton Reel : il attendra.
                </p>
              )}
              {model && reading?.state === "missed" && <p className="text-[13.5px] leading-snug text-danger">{reading.message}</p>}
              <CopyGiver
                studioId={options.studioId}
                another={Boolean(usable)}
                onGiven={followGiven}
              />
            </section>
          )}
          {/* Or a ref for a carousel, a post or a story: captures of one she likes (Instagram does not let a carousel's link open). */}
          {kind !== "reel" && options && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => refRef.current?.click()}
                disabled={refs.files.length >= 4}
                className={`fauve-press flex items-center gap-2.5 self-start rounded-full border-[1.5px] py-1.5 pr-3.5 pl-2 text-left text-[14px] font-bold disabled:opacity-60 ${
                  refs.files.length ? "border-violet bg-violet-tint text-violet" : "border-dashed border-line bg-white text-violet hover:border-violet/40"
                }`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
                  <ImageIcon size={13} />
                </span>
                {refs.files.length ? "Ajouter une capture" : `Ou montre-moi une ref : un ${kind === "carousel" ? "carrousel" : "post"} que tu aimes`}
              </button>
              {!refs.files.length && (
                <p className="-mt-1 pl-1 text-[12.5px] leading-snug text-muted">Une vidéo où tu le fais défiler (enregistrement d’écran), ou des captures.</p>
              )}
              {refs.files.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <FileStrip files={refs.files} onRemove={refs.removeFile} />
                  <p className="text-[12.5px] leading-snug text-muted">Je suis sa mise en page et son style, avec tes photos et tes mots.</p>
                </div>
              )}
              <input
                ref={refRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  refs.addFiles([...(e.target.files ?? [])].slice(0, 4 - refs.files.length));
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </section>
        )}

        {step === "proposal" && (
        <section className="flex flex-col gap-2.5">
          {/* Edith says back what she will make: one plan, in points, with why (Tristan: « la demande bien reformulée, claire et précise, lisible »). */}
          <div className="flex items-end gap-2.5">
            <Mascot size={46} mood={proposing ? "thinking" : "happy"} still />
            <p aria-live="polite" className="rounded-[20px_20px_20px_6px] bg-[#F3EEF8] px-[15px] py-3 text-[15.5px] leading-[1.4] font-medium">
              {proposing
                ? idea.trim()
                  ? "Je relis ta demande et je regarde tes fichiers…"
                  : "Je regarde tes photos et vidéos…"
                : plan
                  ? idea.trim()
                    ? "Voilà ce que je vais faire, d’après ta demande."
                    : "Voilà ce que je te propose."
                  : "Je n’ai pas pu préparer mon plan : je partirai de ta demande."}
            </p>
          </div>
          {proposing ? (
            <div className="flex flex-col gap-2.5 rounded-[20px] border-[1.5px] border-line p-4" aria-hidden>
              <div className="h-5 w-1/2 animate-pulse rounded-full bg-soft" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded-full bg-soft" style={{ width: `${88 - i * 9}%` }} />
              ))}
            </div>
          ) : plan ? (
            <PlanCard plan={plan} />
          ) : idea.trim() ? (
            <p className="rounded-[18px] bg-soft px-4 py-3 text-[14.5px] leading-snug">{idea.trim()}</p>
          ) : null}
          {!proposing && (
            <button type="button" onClick={() => setStepAt(steps.indexOf("idea"))} className="self-start py-1 text-[14px] font-bold text-violet">
              Changer ma demande
            </button>
          )}
        </section>
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-2 rounded-[16px] bg-peach px-4 py-3 text-[14px] leading-snug text-peach-ink">
            <p className="font-semibold">{error}</p>
            {locked && (
              <Link href="/abonnement" onClick={onClose} className="self-start font-bold underline underline-offset-2">
                {locked === "subscribe" ? "Choisir mon abonnement" : "Avoir plus de crédits"}
              </Link>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-col items-stretch gap-1 border-t border-line bg-white px-5 pt-3 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
        {last && picked.length > 0 && chosenWhen && (
          <div aria-live="polite" className="fauve-enter grid grid-cols-2 gap-2 pb-2">
            <Field wide icon={<CalendarIcon size={17} />} label="Je te fais signe" value={chosenWhen.full} sub={placeLabel(where)} onClick={() => setSheet("date")} />
          </div>
        )}
        {last ? (
          <button
            type="button"
            onClick={() => launch()}
            disabled={!ready || pending}
            className="btn btn-primary h-[54px] text-[17px] font-extrabold shadow-[0_8px_22px_rgba(91,63,217,0.28)] disabled:bg-line disabled:text-muted disabled:shadow-none"
          >
            {pending ? <Spinner /> : null}
            {pending ? "C’est parti…" : "C’est parti"}
          </button>
        ) : (
          <button type="button" onClick={next} disabled={!canNext} className="btn btn-primary h-[54px] text-[17px] font-extrabold disabled:bg-line disabled:text-muted">
            {step === "idea" && !gaveIdea ? "Passer, propose-moi des idées" : "Suivant"}
          </button>
        )}
        {step === "files" && !picked.length ? (
          <>
            <p className="text-center text-[13px] text-muted">Choisis au moins une photo ou une vidéo.</p>
            <button type="button" onClick={() => setSheet("nothing")} className="h-10 text-[14.5px] font-bold text-violet">
              Je n’ai rien sous la main
            </button>
          </>
        ) : step === "files" && sending ? (
          <p className="pt-1 text-center text-[13px] text-muted">J’envoie tes fichiers…</p>
        ) : step === "files" && unfit ? (
          <p className="pt-1 text-center text-[13px] font-semibold text-danger">
            {FORMATS.find((f) => f.kind === kind)!.title} : {unfit.charAt(0).toLowerCase()}{unfit.slice(1)}.
          </p>
        ) : step === "files" && broken ? (
          <p className="pt-1 text-center text-[13px] text-danger">Un fichier n’est pas passé : retire-le ou ajoute-le à nouveau.</p>
        ) : step === "what" && kind === "reel" && !voiceAsked ? (
          <p className="pt-1 text-center text-[13px] text-muted">Voix off ou juste la musique : choisis, tu pourras changer après.</p>
        ) : step === "proposal" && proposing ? (
          <p className="pt-1 text-center text-[13px] text-muted">Une seconde, je prépare ton plan.</p>
        ) : step === "proposal" && !told ? (
          <p className="pt-1 text-center text-[13px] font-semibold text-muted">Dis-moi ce que tu imagines : « Changer ma demande ».</p>
        ) : last ? (
          <p className="pt-1 text-center text-[12.5px] leading-snug text-muted">
            {kind === "reel" ? "Les textes, les animations et la musique, je les choisis." : "La mise en page et les textes, je les choisis."} Tu pourras tout changer après.
          </p>
        ) : null}
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
          <SheetHead title="Quand te faire signe ?" hint="Rien ne part tout seul : à ce moment-là, je t’envoie un rappel et tu le publies d’un mot. Tes prochains jours libres, à ton heure habituelle." onClose={() => setSheet(null)} />
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
        <Sheet
          label="La voix off"
          onClose={() => {
            setLaunchOnVoice(false);
            setSheet(null);
          }}
        >
          <SheetHead
            title="Une voix off sur ce Reel ?"
            hint="Une voix raconte ton Reel, la musique passe dessous. Ou juste la musique. Écoute et choisis."
            onClose={() => {
              setLaunchOnVoice(false);
              setSheet(null);
            }}
          />
          <VoicePicker
            own={options?.ownVoice ?? null}
            value={voiceAsked ? chosenVoice : null}
            onPick={(v) => {
              setVoice(v);
              setSheet(null);
              // Asked by « C’est parti »: her answer launches it.
              if (launchOnVoice) {
                setLaunchOnVoice(false);
                go(v);
              }
            }}
          />
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
            Ou demande une idée à Edith
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
              ? "Aucun crédit n’a été débité. Edith peut réessayer."
              : done
                ? progress?.seconds
                  ? `Ton Reel de ${progress.seconds} secondes t’attend.`
                  : "Ton Reel t’attend."
                : progress?.waiting
                  ? queuedLine(progress.waiting)
                  : `Ton Reel sera prêt dans ${effect ? EFFECT_MINUTES : work.minutes} minutes environ.`}
          </p>
        </div>
        <ol aria-label="Ce que fait Edith" className="flex w-full flex-col rounded-[22px] border border-line bg-white px-[18px] py-2 text-left">
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
            Demander à Edith de réessayer
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

/** One line of what Edith will do (format, voice, when and where): obviously a choice to open. */
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

/** Under the Reel to copy: its name once read, or where its reading is. */
/** The plan Edith will follow: its title, its points in order (the rubric in bold), and why. */
function PlanCard({ plan }: { plan: PostPlan }) {
  return (
    <div className="fauve-enter flex flex-col gap-3 rounded-[20px] border-[1.5px] border-violet/30 bg-white p-4">
      <h3 className="text-[17px] font-extrabold tracking-[-0.01em]">{plan.title}</h3>
      <ul className="flex flex-col gap-2">
        {plan.points.map((point) => {
          const cut = point.indexOf(" : ");
          return (
            <li key={point} className="flex gap-2.5 text-[14.5px] leading-snug">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-violet" aria-hidden />
              <span>
                {cut > 0 && cut < 24 ? (
                  <>
                    <strong className="font-extrabold">{point.slice(0, cut)}</strong> : {point.slice(cut + 3)}
                  </>
                ) : (
                  point
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {plan.why && <p className="border-t border-line pt-2.5 text-[13.5px] leading-snug text-muted">{plan.why}</p>}
    </div>
  );
}

function readingLabel(r: CopyState | null): string {
  if (r?.state === "read") return r.name ? `« ${r.name} »` : "Je l’ai regardé";
  if (r?.state === "missed") return "Je n’ai pas pu le regarder";
  return "Je le regarde…";
}

/** A Reel she likes, given here: its link pasted, or its video chosen (Instagram does not always let a link be opened). */
function CopyGiver({ studioId, another, onGiven }: { studioId: string; another: boolean; onGiven: (id: string) => void }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const give = async (from: Parameters<typeof copyReel>[0]) => {
    setBusy(true);
    setError(null);
    const res = await copyReel(from).catch(() => ({ ok: false as const, error: "Ça n’est pas passé. Réessaie dans un instant." }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setLink("");
    onGiven(res.id);
  };
  const upload = async (file: File) => {
    if (!file.type.startsWith("video/")) return setError("Choisis une vidéo.");
    if (file.size > MAX_FILE_BYTES) return setError("Cette vidéo dépasse 50 Mo : garde juste le passage qui te plaît.");
    setBusy(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const path = `${studioId}/chat/copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: failed } = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type });
    if (failed) {
      setBusy(false);
      return setError("La vidéo n’est pas passée. Réessaie.");
    }
    await give({ upload: { path, mime: file.type, size: file.size } });
  };

  return (
    <div className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-dashed border-line px-3.5 py-3">
      <span className="text-[15px] font-bold text-violet">{another ? "Un autre Reel que tu aimes" : "Un Reel que tu aimes"}</span>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim() && !busy) void give({ link });
        }}
      >
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Colle son lien (Instagram, TikTok…)"
          aria-label="Le lien du Reel"
          className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-white px-3 text-[15px] outline-none focus:border-violet"
        />
        <button type="submit" disabled={busy || !link.trim()} className="btn btn-primary h-11 px-4 disabled:bg-line disabled:text-muted">
          {busy ? <Spinner /> : "OK"}
        </button>
      </form>
      <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="self-start py-1 text-[14px] font-bold text-violet disabled:opacity-50">
        Ou choisis sa vidéo
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <p className="text-[13px] leading-snug text-danger">{error}</p>}
      <p className="text-[12.5px] leading-snug text-muted">Je reprends sa façon de faire, jamais ses images ni ses mots.</p>
    </div>
  );
}

/** « Edith choisit », without, or one of her voices (each to listen to first). */
function VoicePicker({ own, value, onPick }: { own: NewPostOptions["ownVoice"]; value: string | null; onPick: (voice: string) => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const listen = (id: string, url: string) => {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const sample = new Audio(url);
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
      <Choice on={value === "auto"} title="Edith choisit" hint="Une voix quand personne ne parle dans tes vidéos" onClick={() => pick("auto")} />
      <Choice on={value === "off"} title="Sans voix off" hint="Juste la musique" onClick={() => pick("off")} />
      <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
        {[
          ...(own ? [{ id: own.id, name: "Ta voix", hint: "clonée, rien qu’à toi", url: own.sampleUrl }] : []),
          ...SIMONE_VOICES.map((v) => ({ id: v.id as string, name: v.name as string, hint: v.hint as string, url: `${SAMPLES}/${voiceSamplePath(v.id)}` as string | null })),
        ].map((v) => {
          const on = value === v.id;
          return (
            <div key={v.id} className={`flex items-center gap-1.5 rounded-[14px] border-[1.5px] py-1 pr-1 pl-3 ${on ? "border-violet bg-violet-tint" : "border-line bg-white"}`}>
              <button type="button" role="radio" aria-checked={on} onClick={() => pick(v.id)} className="flex min-w-0 flex-1 flex-col py-1.5 text-left">
                <span className="text-[14.5px] font-extrabold">{v.name}</span>
                <span className="truncate text-[12.5px] text-muted">{`${v.hint.charAt(0).toUpperCase()}${v.hint.slice(1)}`}</span>
              </button>
              {v.url && (
                <button
                  type="button"
                  onClick={() => listen(v.id, v.url!)}
                  aria-label={playing === v.id ? `Arrêter ${v.name}` : `Écouter ${v.name}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chip text-ink hover:bg-violet-tint"
                >
                  {playing === v.id ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                </button>
              )}
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
