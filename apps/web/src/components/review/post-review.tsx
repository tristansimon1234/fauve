"use client";

import type { PostCover } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updatePost } from "@/app/(app)/publications/[id]/actions";
import { restoreVersion } from "@/app/(app)/publications/[id]/review-actions";
import { useFauveDrawer } from "@/components/fauve-drawer";
import { CalendarIcon, CheckIcon, ChevronRightIcon, UndoIcon, VolumeIcon, VolumeOffIcon, XIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { whatsappLink } from "@/lib/public-env";
import type { ReviewData } from "@/lib/review";
import { ChangePanel, type ChangeView } from "./change-panel";

// « Ta publication », the page of a Reel for someone who has never edited a video: the
// video as it will go out, when and where, its caption, ONE button that says what it
// does (« Publier vendredi à 18 h »), and « Changer quelque chose ». The full editor
// stays one link away. Same page in the app and from WhatsApp.

const STEPS: Record<string, string> = {
  montage: "Simone refait le montage",
  "2e version": "Simone essaie une autre version",
  rendu: "Simone fabrique la vidéo",
  relecture: "Simone relit tout",
  correction: "Simone corrige un détail",
};

export function PostReview({
  data,
  surface,
  editorHref,
  whatsAppPrefix,
  cover,
  shareToFeed,
}: {
  data: ReviewData;
  /** In the app (menu, Simone's panel) or on the page opened from WhatsApp. */
  surface: "app" | "whatsapp";
  editorHref: string;
  /** From WhatsApp, « Autre chose » goes back to WhatsApp with her words after this. */
  whatsAppPrefix?: string;
  cover: PostCover | null;
  shareToFeed: boolean;
}) {
  const router = useRouter();
  const openDrawer = useFauveDrawer();
  const video = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const [view, setView] = useState<ChangeView>("menu");
  const [sheet, setSheet] = useState(false);
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

  const done = (message: string) => {
    setView("menu");
    setSheet(false);
    if (message) setToast(message);
    video.current?.play().catch(() => {});
    router.refresh();
  };
  const seek = (seconds: number) => {
    const el = video.current;
    if (!el) return;
    el.pause();
    el.currentTime = seconds;
  };
  const ask = (text: string) => {
    if (surface === "whatsapp") {
      window.location.href = whatsappLink(`${whatsAppPrefix ?? ""}${text}`);
      return;
    }
    setSheet(false);
    openDrawer({ postId: data.postId, title: data.title, start: { text, files: [] } });
  };
  const toggleSound = () => {
    const el = video.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted) el.play().catch(() => {});
    setSound(!el.muted);
  };
  const openView = (next: ChangeView) => {
    setView(next);
    // From a laptop the panel is beside the video: no sheet.
    if (!window.matchMedia("(min-width: 1024px)").matches) setSheet(true);
  };

  const scheduled = data.status === "scheduled" || data.status === "validated";
  const where = data.platforms.length ? data.platforms.map((p) => (p === "tiktok" ? "TikTok" : "Instagram")).join(" et ") : "Instagram";
  const publishLabel = !data.instagram
    ? "Valider"
    : `${data.publishByHand ? "Me l’envoyer" : "Publier"} ${data.when && data.upcoming ? data.when.short : "maintenant"}`;

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

  const panel = (
    <ChangePanel
      data={data}
      view={view}
      onView={setView}
      onDone={done}
      seek={seek}
      ask={ask}
      editorHref={editorHref}
      cover={cover}
      shareToFeed={shareToFeed}
    />
  );

  const action = data.locked ? null : scheduled ? (
    <div className="flex items-start gap-3 rounded-[18px] bg-success-soft px-4 py-3.5 text-success">
      <CheckIcon size={20} className="mt-0.5 shrink-0" />
      <p className="text-[14.5px] leading-snug font-semibold">
        {data.status === "scheduled" && data.when
          ? `C’est programmé : il part ${data.when.short}, sur ${where}. Tu peux encore le changer d’ici là.`
          : "C’est validé. Connecte Instagram dans Réglages pour que Simone le publie."}
      </p>
    </div>
  ) : data.making ? (
    <button type="button" disabled className="btn h-[54px] w-full bg-line text-[16px] text-muted">
      Simone finit la nouvelle version…
    </button>
  ) : (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={publish} disabled={pending || !data.videoUrl} className="btn btn-primary h-[54px] w-full text-[17px] shadow-[0_8px_22px_rgba(91,63,217,0.26)] disabled:opacity-60">
        {pending ? "Un instant…" : publishLabel}
      </button>
      {!data.instagram && <p className="text-center text-[12.5px] text-muted">Connecte Instagram dans Réglages pour que Simone le publie toute seule.</p>}
      {data.publishByHand && data.instagram && (
        <p className="text-center text-[12.5px] text-muted">À l’heure prévue, Simone t’envoie la vidéo et la légende sur WhatsApp : tu publies avec le son de ton choix.</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pb-36 lg:pb-0">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        {/* The Reel as it will go out. */}
        <section aria-label="Aperçu" className="flex flex-col items-center gap-3 rounded-[24px] bg-soft px-4 py-5 lg:py-8">
          <StatusLine data={data} onBack={back} pending={pending} />
          {/* On a phone it leaves room for the date and the buttons below; from a laptop, 320 px wide. */}
          <div className="relative aspect-[9/16] w-[max(176px,min(280px,calc((100dvh-400px)*0.5625)))] overflow-hidden rounded-[22px] bg-ink shadow-[0_18px_44px_rgba(28,21,48,.18)] lg:w-[320px]">
            {data.videoUrl ? (
              <video key={data.videoUrl} ref={video} src={data.videoUrl} autoPlay muted loop playsInline preload="auto" className="size-full object-cover" aria-label="Ton Reel" />
            ) : null}
            {data.videoUrl && (
              <button
                type="button"
                onClick={toggleSound}
                aria-label={sound ? "Couper le son" : "Mettre le son"}
                className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur-sm"
              >
                {sound ? <VolumeIcon size={20} /> : <VolumeOffIcon size={20} />}
              </button>
            )}
            {data.failed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 p-6 text-center text-white">
                <span className="flex size-20 items-center justify-center rounded-full bg-white">
                  <Mascot size={64} mood="sad" />
                </span>
                <span className="text-[16px] font-extrabold">La vidéo n’a pas pu être fabriquée</span>
                <span className="text-[13px] leading-snug text-white/85">Dis-le à Simone dans « Autre chose » : elle la relance.</span>
              </div>
            )}
            {!data.failed && (data.making || !data.videoUrl) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/65 p-6 text-center text-white">
                <span className="flex size-20 items-center justify-center rounded-full bg-white">
                  <Mascot size={64} mood="thinking" />
                </span>
                <span className="text-[16px] font-extrabold">{data.making?.step ? (STEPS[data.making.step] ?? "Simone y travaille") : "La vidéo se met à jour"}</span>
                <span className="text-[13px] leading-snug text-white/85">Ça prend une à deux minutes. Tu peux fermer, Simone te prévient.</span>
              </div>
            )}
          </div>
          <p className="w-full max-w-[320px] text-[13.5px] leading-snug">
            <strong className="font-extrabold">{data.handle ?? "toi"}</strong> {clip(data.captionShown)}{" "}
            {!data.locked && (
              <button type="button" onClick={() => openView("caption")} className="font-semibold text-muted hover:text-ink">
                modifier
              </button>
            )}
          </p>
        </section>

        <aside className="flex flex-col gap-3.5">
          <button
            type="button"
            onClick={() => !data.locked && openView("date")}
            disabled={data.locked}
            className="flex w-full items-center gap-3 rounded-[20px] border border-line bg-white py-2.5 pr-4 pl-2.5 text-left hover:border-lilac disabled:hover:border-line"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-tint text-violet">
              <CalendarIcon size={19} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-extrabold">{data.when?.full ?? "Date à choisir"}</span>
              <span className="text-[13px] text-muted">{where}</span>
            </span>
            {!data.locked && <ChevronRightIcon size={18} className="text-muted" />}
          </button>

          <div className="hidden lg:block">{action}</div>
          {error && (
            <p role="alert" className="hidden text-[13.5px] font-semibold text-danger lg:block">
              {error}
            </p>
          )}

          {/* One panel at a time: beside the video from a laptop, in the sheet on a phone. */}
          {!data.locked && !sheet && <div className="hidden rounded-[24px] border border-line bg-white p-5 lg:block">{panel}</div>}
        </aside>
      </div>

      {/* Phone: the button that publishes and « Changer quelque chose », always at hand. */}
      {!data.locked && (
        <div
          className={`fixed inset-x-0 z-30 flex flex-col gap-2 border-t border-line bg-white/95 px-4 pt-3 pb-3 backdrop-blur lg:hidden ${surface === "app" ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"}`}
        >
          {error && (
            <p role="alert" className="text-center text-[13.5px] font-semibold text-danger">
              {error}
            </p>
          )}
          {action}
          <button type="button" onClick={() => openView("menu")} className="btn btn-secondary h-[50px] w-full text-[16px] font-extrabold">
            Changer quelque chose
          </button>
        </div>
      )}

      {sheet && (
        <Sheet onClose={() => setSheet(false)} label="Changer quelque chose">
          {panel}
        </Sheet>
      )}

      {toast && (
        <p
          role="status"
          className={`fixed inset-x-4 z-40 mx-auto max-w-[420px] rounded-[18px] bg-ink px-4 py-3 text-center text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(28,21,48,.25)] lg:bottom-8 ${surface === "app" ? "bottom-[calc(14rem+env(safe-area-inset-bottom))]" : "bottom-[calc(9.5rem+env(safe-area-inset-bottom))]"}`}
        >
          {toast}
        </p>
      )}
    </div>
  );
}

/** About two lines of the caption, as the feed shows it before « plus ». */
const clip = (caption: string) => {
  const flat = caption.replace(/\s+/g, " ").trim();
  return flat.length > 110 ? `${flat.slice(0, 108).replace(/\s+\S*$/, "")}…` : flat;
};

function StatusLine({ data, onBack, pending }: { data: ReviewData; onBack: () => void; pending: boolean }) {
  if (data.locked) return <p className="text-[13.5px] font-bold text-success">Publié</p>;
  if (data.making) return <p className="text-[13.5px] font-semibold text-muted">Une nouvelle version arrive</p>;
  const scheduled = data.status === "scheduled" || data.status === "validated";
  if (data.previous !== null) {
    return (
      <p className="flex flex-wrap items-center justify-center gap-x-2 text-[13.5px] font-semibold">
        <span>{scheduled ? "Programmé, nouvelle version" : "Nouvelle version"}</span>
        <span aria-hidden="true" className="text-line">
          |
        </span>
        <button type="button" onClick={onBack} disabled={pending} className="inline-flex items-center gap-1 font-bold text-violet underline underline-offset-3 disabled:opacity-60">
          <UndoIcon size={15} />
          Revenir à l’ancienne
        </button>
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-success">
      <span className="size-2 rounded-full bg-online" />
      {data.status === "scheduled" ? "Programmé" : data.status === "validated" ? "Validé, en attente d’Instagram" : "Prêt, pas encore publié"}
    </p>
  );
}

/** A panel that rises from the bottom of the phone; Escape or a tap outside closes it. */
function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button type="button" aria-label="Fermer" onClick={onClose} className="fauve-fade absolute inset-0 bg-ink/45" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="fauve-enter absolute inset-x-0 bottom-0 [--fauve-y:48px] max-h-[88dvh] overflow-y-auto rounded-t-[26px] bg-white px-5 pt-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(28,21,48,.14)] outline-none"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="mx-auto h-1 w-10 rounded-full bg-track" aria-hidden="true" />
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-chip">
          <XIcon size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
