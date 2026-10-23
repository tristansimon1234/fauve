"use client";

import { EFFECT_MINUTES, REDO_MINUTES, RERENDER_MINUTES } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updatePost } from "@/app/(app)/publications/[id]/actions";
import { restoreVersion } from "@/app/(app)/publications/[id]/review-actions";
import { ArrowDownIcon, ArrowLeftIcon, CaptionIcon, CheckIcon, PenIcon, UndoIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { whatsappLink } from "@/lib/public-env";
import type { ReviewData } from "@/lib/review";

// A Reel opened from WhatsApp (/v/{id}): a page made for her phone, not the app. The video
// full screen as on Instagram, and only what she does from there: publish it, save it, copy
// its caption, or tell Simone what to change, back in WhatsApp where everything else happens
// (Tristan: « il ne doit pas envoyer de lien vers une app, juste des pages optimisées »).

export function PhoneReview({ data }: { data: ReviewData }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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

  const toggleSound = () => {
    const el = video.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted) el.play().catch(() => {});
    setSound(!el.muted);
  };
  const publish = () =>
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
  const sent = data.status === "scheduled" || data.status === "validated";
  const publishLabel = !data.instagram ? "C’est bon pour moi" : data.publishByHand ? "Me l’envoyer sur WhatsApp" : `Publier sur ${where}`;
  const change = whatsappLink(`Pour « ${data.title} » : `);
  const ready = Boolean(data.videoUrl) && !data.making && !data.failed;

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
          onClick={toggleSound}
          className="absolute inset-0 size-full object-cover"
          aria-label={`Ton Reel « ${data.title} »`}
        />
      )}
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
      <div className="relative z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-8">
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
      <div className="relative z-10 mt-auto flex flex-col gap-3 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {data.captionShown && (
          <button type="button" onClick={() => setOpen(!open)} className="text-left text-[14px] leading-snug drop-shadow">
            {data.handle && <strong className="font-extrabold">{data.handle} </strong>}
            <span className={open ? "whitespace-pre-line" : "line-clamp-2"}>{data.captionShown}</span>
          </button>
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

        {data.locked ? null : sent ? (
          <p className="flex items-start gap-2 rounded-[18px] bg-white/15 px-4 py-3 text-[14.5px] leading-snug font-semibold backdrop-blur-sm">
            <CheckIcon size={19} className="mt-0.5 shrink-0" />
            {data.status === "scheduled" ? `C’est parti sur ${where}, je te dis quand il est en ligne.` : "C’est validé. Relie ton Instagram et je le publie."}
          </p>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={pending || !ready}
            className="h-[54px] w-full rounded-full bg-violet text-[17px] font-extrabold shadow-[0_8px_22px_rgba(91,63,217,0.4)] disabled:opacity-50"
          >
            {pending ? "Un instant…" : publishLabel}
          </button>
        )}

        <div className="flex gap-2 *:flex-1">
          {!data.locked && (
            <a href={change} className="flex flex-col items-center gap-1 rounded-[16px] bg-white/15 py-2.5 text-[12.5px] font-bold backdrop-blur-sm">
              <PenIcon size={19} /> Changer
            </a>
          )}
          {data.downloadUrl && (
            <a href={data.downloadUrl} download className="flex flex-col items-center gap-1 rounded-[16px] bg-white/15 py-2.5 text-[12.5px] font-bold backdrop-blur-sm">
              <ArrowDownIcon size={19} /> Enregistrer
            </a>
          )}
          {data.captionShown && (
            <button type="button" onClick={copy} className="flex flex-col items-center gap-1 rounded-[16px] bg-white/15 py-2.5 text-[12.5px] font-bold backdrop-blur-sm">
              {copied ? <CheckIcon size={19} /> : <CaptionIcon size={19} />} {copied ? "Copiée" : "La légende"}
            </button>
          )}
        </div>
      </div>

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
