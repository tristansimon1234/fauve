"use client";

import { EFFECT_MINUTES, REDO_MINUTES, RERENDER_MINUTES } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updatePost } from "@/app/(app)/publications/[id]/actions";
import { restoreVersion } from "@/app/(app)/publications/[id]/review-actions";
import { ArrowLeftIcon, ArrowUpIcon, CalendarIcon, CaptionIcon, CheckIcon, DownloadIcon, PenIcon, UndoIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { PausedSign, useReelPlayback } from "@/components/review/reel-player";
import { whatsappLink } from "@/lib/public-env";
import type { ReviewData } from "@/lib/review";
import { needsInstagram, ReviewSheets, type ReviewSheet } from "./review-sheets";

// A Reel opened from WhatsApp (/v/{id}): a page made for her phone, not the app. The video
// full screen as on Instagram, and only what she does from there, the same buttons as its page
// in the app (Tristan: « la page de publication envoyée sur WhatsApp mobile doit avoir les mêmes
// boutons »): publish it, save it, choose when Simone reminds her to post it, or tell Simone what to
// change, back in WhatsApp where everything else happens (« il ne doit pas envoyer de lien vers
// une app, juste des pages optimisées »); its caption is copied from the caption itself.

export function PhoneReview({ data }: { data: ReviewData }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  // It plays silently behind her buttons; a touch plays it from the start with its sound and
  // clears the screen, the next one pauses it and brings them back (Tristan: « quand je clique
  // sur play les actions disparaissent, pause elles réapparaissent »). Silent once its page is hidden.
  const { playing, sound, toggle, toggleSound, seek } = useReelPlayback(video, data.videoUrl);
  const [watching, setWatching] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** « Prévoir » open, or « Publier » before Instagram is connected. */
  const [sheet, setSheet] = useState<ReviewSheet | null>(null);

  // A new version on its way: the page follows it until the video is there.
  useEffect(() => {
    if (!data.making) return;
    const timer = setInterval(() => router.refresh(), 12_000);
    return () => clearInterval(timer);
  }, [data.making, router]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const publish = () => {
    if (needsInstagram(data)) return setSheet("instagram");
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("intent", "validate");
      form.set("caption", data.caption);
      const result = await updatePost(data.postId, { status: "idle" }, form);
      if (result.status === "error") return setError(result.message);
      if (result.status === "ok") setToast(result.message);
      router.refresh();
    });
  };
  const planned = (message: string) => {
    setSheet(null);
    if (!message) return;
    setToast(message);
    router.refresh();
  };
  const back = () =>
    start(async () => {
      setError(null);
      if (data.previous === null) return;
      const result = await restoreVersion(data.postId, data.previous);
      if (!result.ok) return setError(result.error);
      setToast("Tu as retrouvé la version d’avant.");
      router.refresh();
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.captionShown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
    }
  };

  const where = data.platforms.length ? data.platforms.map((p) => (p === "tiktok" ? "TikTok" : "Instagram")).join(" et ") : "Instagram";
  const sent = data.status === "scheduled";
  const change = whatsappLink(`Pour « ${data.title} » : `);
  const tile = "flex h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[13px] font-extrabold disabled:opacity-50";
  const ready = Boolean(data.videoUrl) && !data.making && !data.failed;
  const tap = () => {
    if (!ready) return;
    if (watching) return toggle();
    setWatching(true);
    seek(0);
    if (!sound) toggleSound();
    else if (!playing) toggle();
  };
  // Only while she watches it: the Reel alone, as it will go out.
  const quiet = ready && watching && playing;
  const fade = `transition-opacity duration-300 ${quiet ? "pointer-events-none opacity-0" : "opacity-100"}`;

  return (
    <main className="relative mx-auto flex h-dvh sm:max-w-[calc(100dvh*9/16)] flex-col overflow-hidden bg-black text-white">
      {/* The Reel, as it will go out. */}
      {data.videoUrl && (
        <video
          key={data.videoUrl}
          ref={video}
          src={data.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onClick={tap}
          className="absolute inset-0 size-full object-cover"
          aria-label={`Ton Reel « ${data.title} »`}
        />
      )}
      {ready && <PausedSign playing={watching && playing} />}
      {data.failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/80 px-8 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-white">
            <Mascot size={64} mood="sad" />
          </span>
          <span className="text-[18px] font-extrabold">La vidéo n’a pas pu être fabriquée</span>
          <span className="text-[14px] leading-snug text-white/80">Dis-le-moi sur WhatsApp, je la relance.</span>
        </div>
      ) : (
        (data.making || !data.videoUrl) && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80 px-8">
            <Making step={data.making?.step ?? null} kind={data.making?.kind ?? "render"} minutes={data.making?.minutes} again={Boolean(data.videoUrl)} />
          </div>
        )
      )}

      {/* Top: back to WhatsApp, the sound. */}
      <div className={`relative z-10 flex items-center justify-between gap-3 ${fade} bg-gradient-to-b from-black/55 to-transparent px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-8`}>
        <a href={whatsappLink("")} aria-label="Retourner sur WhatsApp" className="flex size-11 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
          <ArrowLeftIcon size={20} />
        </a>
        <span className="min-w-0 flex-1 truncate text-center text-[14px] font-bold drop-shadow">
          {data.locked ? "Publié" : data.making ? "Une nouvelle version arrive" : sent ? "En route" : "Prêt à publier"}
        </span>
        {ready ? (
          <button
            type="button"
            onClick={toggleSound}
            aria-label={sound ? "Couper le son" : "Mettre le son"}
            className="flex size-11 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm"
          >
            {sound ? <VolumeIcon size={20} /> : <VolumeOffIcon size={20} />}
          </button>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {/* Bottom: the caption as the feed shows it, then what she does. */}
      <div className={`relative z-10 mt-auto flex flex-col gap-3 ${fade} bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        {data.captionShown && (
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setOpen(!open)} className="text-left text-[14px] leading-snug drop-shadow">
              {data.handle && <strong className="font-extrabold">{data.handle} </strong>}
              <span className={open ? "whitespace-pre-line" : "line-clamp-2"}>{data.captionShown}</span>
            </button>
            {open && (
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-white/85 underline underline-offset-3">
                {copied ? <CheckIcon size={14} /> : <CaptionIcon size={14} />}
                {copied ? "Légende copiée" : "Copier la légende"}
              </button>
            )}
          </div>
        )}

        {data.previous !== null && !data.locked && !data.making && (
          <button type="button" onClick={back} disabled={pending} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-white/85 underline underline-offset-3">
            <UndoIcon size={14} /> Revenir à l’ancienne version
          </button>
        )}

        {error && (
          <p role="alert" className="rounded-[14px] bg-danger px-3 py-2 text-[13.5px] font-semibold">
            {error}
          </p>
        )}

        {data.locked ? (
          data.downloadUrl && (
            <a href={data.downloadUrl} download className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-white/15 text-[15px] font-extrabold backdrop-blur-sm">
              <DownloadIcon size={19} /> Télécharger
            </a>
          )
        ) : sent ? (
          <p className="flex items-start gap-2 rounded-[18px] bg-white/15 px-4 py-3 text-[14.5px] leading-snug font-semibold backdrop-blur-sm">
            <CheckIcon size={19} className="mt-0.5 shrink-0" />
            {`C’est parti sur ${where}, je te dis quand il est en ligne.`}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={publish} disabled={pending || !ready} className={`${tile} bg-violet shadow-[0_8px_22px_rgba(91,63,217,0.4)]`}>
                <ArrowUpIcon size={19} />
                {pending ? "Un instant…" : data.publishByHand ? "Me l’envoyer" : "Publier"}
              </button>
              {data.downloadUrl ? (
                <a href={data.downloadUrl} download className={`${tile} bg-white/15 backdrop-blur-sm`}>
                  <DownloadIcon size={19} />
                  Télécharger
                </a>
              ) : (
                <button type="button" disabled className={`${tile} bg-white/15 backdrop-blur-sm`}>
                  <DownloadIcon size={19} />
                  Télécharger
                </button>
              )}
              <button type="button" onClick={() => setSheet("date")} className={`${tile} bg-white/15 backdrop-blur-sm`}>
                <CalendarIcon size={19} />
                Prévoir
              </button>
            </div>
            {data.upcoming && data.when && <p className="text-center text-[12.5px] font-semibold text-white/80">Je te fais signe {data.when.short} pour le poster.</p>}
          </div>
        )}

        {!data.locked && (
          <a href={change} className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-white/15 text-[15.5px] font-extrabold backdrop-blur-sm">
            <PenIcon size={18} /> Modifier avec Simone
          </a>
        )}
      </div>

      <ReviewSheets sheet={sheet} data={data} onClose={() => setSheet(null)} onPlanned={planned} />

      {toast && (
        <p role="status" className="absolute inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-20 rounded-[18px] bg-white px-4 py-3 text-center text-[14px] font-bold text-ink shadow-lg">
          {toast}
        </p>
      )}
    </main>
  );
}

/** Where the montage is, said plainly: its step, how long it has been going, what it usually takes. */
const STEPS: Record<string, string> = {
  montage: "Je monte ton Reel",
  effet: "Je fais l’effet image par image",
  "2e version": "J’essaie une autre version",
  rendu: "Je fabrique la vidéo",
  relecture: "Je relis tout",
  correction: "Je corrige un détail",
};
const ORDER = ["montage", "rendu"];

function Making({ step, kind, minutes, again }: { step: string | null; kind: "render" | "montage"; minutes?: number; again: boolean }) {
  const usual = step === "effet" ? EFFECT_MINUTES : kind === "montage" ? REDO_MINUTES : RERENDER_MINUTES;
  const at = step ? ORDER.indexOf(step === "effet" || step === "2e version" ? "montage" : step === "relecture" || step === "correction" ? "rendu" : step) : 1;
  return (
    <div className="flex flex-col items-center gap-3 text-center text-white">
      <span className="flex size-20 items-center justify-center rounded-full bg-white">
        <Mascot size={64} mood="thinking" />
      </span>
      <span className="text-[19px] font-extrabold">{step ? (STEPS[step] ?? "J’y travaille") : again ? "Je mets la vidéo à jour" : "Je fabrique ta vidéo"}</span>
      {/* The two steps she can picture: the montage, then the video. */}
      <span className="flex items-center gap-2 text-[12.5px] font-bold" aria-hidden="true">
        {["Montage", "Vidéo"].map((label, i) => (
          <span key={label} className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${i < at ? "bg-white/25 text-white" : i === at ? "bg-violet text-white" : "bg-white/10 text-white/55"}`}>
            {i < at && <CheckIcon size={13} />}
            {label}
          </span>
        ))}
      </span>
      <span className="text-[14px] leading-snug text-white/80">
        {minutes !== undefined && minutes > 0 ? `En cours depuis ${minutes} min, ça prend en général ${usual} minutes.` : `Ça prend en général ${usual} minutes.`} Tu peux fermer : je te préviens sur WhatsApp dès qu’il est prêt.
      </span>
    </div>
  );
}

/**
 * Her Reel before its first version (the link of « je te l'envoie dès qu'il est prêt », opened early):
 * where it is, and the page follows it until the video is there.
 */
export function PhoneMaking({ title, step, minutes }: { title: string; step: string | null; minutes: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 12_000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <main className="mx-auto flex h-dvh sm:max-w-[calc(100dvh*9/16)] flex-col bg-ink text-white">
      <div className="flex items-center gap-3 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <a href={whatsappLink("")} aria-label="Retourner sur WhatsApp" className="flex size-11 items-center justify-center rounded-full bg-white/10">
          <ArrowLeftIcon size={20} />
        </a>
        <span className="min-w-0 flex-1 truncate text-center text-[14px] font-bold">{title}</span>
        <span className="size-11" />
      </div>
      <div className="flex flex-1 items-center justify-center px-8">
        <Making step={step} kind="montage" minutes={minutes} again={false} />
      </div>
    </main>
  );
}
