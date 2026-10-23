"use client";

import { DEFAULT_COVER_SECONDS, EFFECT_MINUTES, REDO_MINUTES, RERENDER_MINUTES, type PostCover } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updatePost } from "@/app/(app)/publications/[id]/actions";
import { useFauveDrawer } from "@/components/fauve-drawer";
import { CheckIcon, PauseIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { CoverPicker } from "@/components/montage/cover-picker";
import { PausedSign, Scrubber, useReelPlayback } from "@/components/review/reel-player";
import { whatsappLink } from "@/lib/public-env";
import type { ReviewData } from "@/lib/review";

// « Ta publication », the page of a Reel, and nothing more (Tristan: « enlève tout sauf
// la légende, qui doit être tout le temps visible, et la photo de couverture, et juste un
// bouton demande une modif à Simone qui ouvre le drawer, that's it »): the video as it
// will go out, its whole caption (written over in place), its cover, « Publier maintenant », and « Demander une
// modif à Simone » (her panel in the app, WhatsApp from the page of the links). Every
// other change is asked to Simone.

const STEPS: Record<string, string> = {
  montage: "Simone refait le montage",
  effet: "Simone fait l’effet image par image",
  "2e version": "Simone essaie une autre version",
  rendu: "Simone fabrique la vidéo",
  relecture: "Simone relit tout",
  correction: "Simone corrige un détail",
};

export function PostReview({
  data,
  surface,
  whatsAppPrefix,
  cover,
  shareToFeed,
}: {
  data: ReviewData;
  /** In the app (menu, Simone's panel) or on the page opened from WhatsApp. */
  surface: "app" | "whatsapp";
  /** From WhatsApp, « Demander une modif » goes back to WhatsApp with her words after this. */
  whatsAppPrefix?: string;
  cover: PostCover | null;
  shareToFeed: boolean;
}) {
  const router = useRouter();
  const openDrawer = useFauveDrawer();
  const video = useRef<HTMLVideoElement>(null);
  const player = useReelPlayback(video, data.videoUrl);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Her caption as she writes it: « Publier » sends it, saved or not.
  const [caption, setCaption] = useState(data.captionShown);

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

  const ask = () => {
    if (surface === "whatsapp") {
      window.location.href = whatsappLink(whatsAppPrefix ?? "");
      return;
    }
    openDrawer({ postId: data.postId, title: data.title });
  };

  const scheduled = data.status === "scheduled" || data.status === "validated";
  const where = data.platforms.length ? data.platforms.map((p) => (p === "tiktok" ? "TikTok" : "Instagram")).join(" et ") : "Instagram";
  const publishLabel = !data.instagram ? "Valider" : `${data.publishByHand ? "Me l’envoyer" : "Publier"} maintenant`;

  const publish = () =>
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("intent", "validate");
      form.set("caption", caption);
      const result = await updatePost(data.postId, { status: "idle" }, form);
      if (result.status === "error") return setError(result.message);
      if (result.status === "ok") setToast(result.message);
      router.refresh();
    });

  const action = data.locked ? null : scheduled ? (
    <div className="flex items-start gap-3 rounded-[18px] bg-success-soft px-4 py-3.5 text-success">
      <CheckIcon size={20} className="mt-0.5 shrink-0" />
      <p className="text-[14.5px] leading-snug font-semibold">
        {data.status === "scheduled"
          ? `C’est parti : il part sur ${where}, Simone te dit quand il est en ligne.`
          : "C’est validé. Connecte Instagram dans Réglages pour que Simone le publie."}
      </p>
    </div>
  ) : data.making ? (
    <button type="button" disabled className="btn h-[54px] w-full bg-line text-[16px] text-muted">
      Simone finit la nouvelle version…
    </button>
  ) : (
    <button type="button" onClick={publish} disabled={pending || !data.videoUrl} className="btn btn-primary h-[54px] w-full text-[17px] shadow-[0_8px_22px_rgba(91,63,217,0.26)] disabled:opacity-60">
      {pending ? "Un instant…" : publishLabel}
    </button>
  );
  const askButton = !data.locked && (
    <button type="button" onClick={ask} className="btn btn-secondary h-[50px] w-full text-[16px] font-extrabold">
      Demander une modif à Simone
    </button>
  );

  return (
    <div className="flex flex-col gap-5 pb-36 lg:pb-0">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        {/* The Reel as it will go out. */}
        <section aria-label="Aperçu" className="flex flex-col items-center gap-3 rounded-[24px] bg-soft px-4 py-5 lg:py-8">
          {data.locked && <p className="text-[13.5px] font-bold text-success">Publié</p>}
          <div className="relative aspect-[9/16] w-[max(176px,min(280px,calc((100dvh-470px)*0.5625)))] overflow-hidden rounded-[22px] bg-ink shadow-[0_18px_44px_rgba(28,21,48,.18)] lg:w-[320px]">
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
                onClick={player.toggle}
                className="size-full cursor-pointer object-cover"
                aria-label="Ton Reel : touche pour mettre en pause ou relancer"
              />
            )}
            {data.videoUrl && <PausedSign playing={player.playing} />}
            {data.videoUrl && (
              // Play or pause, where it is (drag to go forward or back), its sound.
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-8 pb-2.5">
                <button
                  type="button"
                  onClick={player.toggle}
                  aria-label={player.playing ? "Mettre en pause" : "Lire la vidéo"}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                >
                  {player.playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
                </button>
                <Scrubber time={player.time} duration={player.duration} onSeek={player.seek} />
                <button
                  type="button"
                  onClick={player.toggleSound}
                  aria-label={player.sound ? "Couper le son" : "Mettre le son"}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                >
                  {player.sound ? <VolumeIcon size={18} /> : <VolumeOffIcon size={18} />}
                </button>
              </div>
            )}
            {data.failed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 p-6 text-center text-white">
                <span className="flex size-20 items-center justify-center rounded-full bg-white">
                  <Mascot size={64} mood="sad" />
                </span>
                <span className="text-[16px] font-extrabold">La vidéo n’a pas pu être fabriquée</span>
                <span className="text-[13px] leading-snug text-white/85">Demande-le à Simone : il la relance.</span>
              </div>
            )}
            {!data.failed && (data.making || !data.videoUrl) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/65 p-6 text-center text-white">
                <span className="flex size-20 items-center justify-center rounded-full bg-white">
                  <Mascot size={64} mood="thinking" />
                </span>
                <span className="text-[16px] font-extrabold">{data.making?.step ? (STEPS[data.making.step] ?? "Simone y travaille") : "La vidéo se met à jour"}</span>
                <span className="text-[13px] leading-snug text-white/85">
                  {`Ça prend ${data.making?.step === "effet" ? EFFECT_MINUTES : data.making?.kind === "montage" ? REDO_MINUTES : RERENDER_MINUTES} minutes.`} Tu peux fermer, Simone te prévient.
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-3.5">
          <Caption data={data} caption={caption} onChange={setCaption} onSaved={() => setToast("Légende enregistrée.")} />

          {data.videoUrl && !data.locked && !data.making && (
            <CoverPicker postId={data.postId} videoUrl={data.videoUrl} initial={cover} defaultAt={DEFAULT_COVER_SECONDS} initialShareToFeed={shareToFeed} photos={[]} />
          )}

          <div className="hidden flex-col gap-2.5 lg:flex">
            {action}
            {error && (
              <p role="alert" className="text-[13.5px] font-semibold text-danger">
                {error}
              </p>
            )}
            {askButton}
          </div>
        </aside>
      </div>

      {/* Phone: the two buttons always at hand. */}
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
          {askButton}
        </div>
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

/** Its whole caption, always in sight, written over in place (as Instagram will show it, hashtags included). */
function Caption({ data, caption, onChange: setCaption, onSaved }: { data: ReviewData; caption: string; onChange: (caption: string) => void; onSaved: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = caption.trim() !== data.captionShown.trim();
  const save = () =>
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("intent", "save");
      form.set("caption", caption);
      const result = await updatePost(data.postId, { status: "idle" }, form);
      if (result.status === "error") return setError(result.message);
      onSaved();
      router.refresh();
    });
  return (
    <section aria-label="Légende" className="flex flex-col gap-2 rounded-[20px] border border-line bg-white p-4">
      <label htmlFor={`caption-${data.postId}`} className="text-[13px] font-bold text-muted">
        Légende
      </label>
      {data.locked ? (
        <p className="text-[14.5px] leading-relaxed whitespace-pre-line">{data.captionShown}</p>
      ) : (
        <textarea
          id={`caption-${data.postId}`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2200}
          rows={7}
          placeholder="Simone l’écrit avec la vidéo."
          className="w-full resize-y rounded-[14px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[14.5px] leading-relaxed outline-none focus:border-violet"
        />
      )}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
      {changed && !data.locked && (
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary h-10 px-4 text-[14px] disabled:opacity-60">
            {pending ? "Un instant…" : "Enregistrer"}
          </button>
          <button type="button" onClick={() => setCaption(data.captionShown)} disabled={pending} className="btn btn-secondary h-10 px-4 text-[14px]">
            Annuler
          </button>
        </div>
      )}
    </section>
  );
}
