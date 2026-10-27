"use client";

import { DEFAULT_COVER_SECONDS, EFFECT_MINUTES, REDO_MINUTES, RERENDER_MINUTES, timeline, type PostCover } from "@fauve/agent";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { updatePost } from "@/app/(app)/publications/[id]/actions";
import { restoreVersion } from "@/app/(app)/publications/[id]/review-actions";
import { useFauveDrawer } from "@/components/fauve-drawer";
import { ArrowUpIcon, CalendarIcon, CheckIcon, DownloadIcon, PauseIcon, PenIcon, PlayIcon, UndoIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { CoverPicker } from "@/components/montage/cover-picker";
import { PausedSign, Scrubber, useReelPlayback } from "@/components/review/reel-player";
import { whatsappLink } from "@/lib/public-env";
import type { ReviewData } from "@/lib/review";
import { OpeningEditor, type EditorParts } from "./editor-parts";
import type { EditStart } from "./reel-editor";
import { needsInstagram, ReviewSheets, type ReviewSheet } from "./review-sheets";
import { SceneStrip } from "./scene-strip";

// « Modifier » plays the montage live (Remotion): its code is loaded only when she opens it.
type EditorModule = typeof import("./reel-editor");

// « Ta publication », the page of a Reel, and nothing more (Tristan: « enlève tout sauf
// la légende, qui doit être tout le temps visible, et la photo de couverture, et juste un
// bouton demande une modif à Edith qui ouvre le drawer, that's it »): the video as it
// will go out, its whole caption (written over in place), its cover, « Publier », « Télécharger », « Prévoir »
// (when Edith reminds her to post it) and « Modifier avec Edith » (Tristan: « 3 boutons publier, télécharger,
// prévoir + modifier avec simone »; her panel in the app, WhatsApp from the page of the links). Above the
// video, « Revenir à l'ancienne » (and back to the newer one); under it, its scenes: a tap
// changes that scene alone, in place (Tristan: « remettre revenir à l'ancienne version et
// pouvoir modifier qu'une scène »): the Reel plays live in the same frame, the panel beside
// becomes the scene, « Annuler » / « Enregistrer » there (and in the bar at the bottom of a phone).

const STEPS: Record<string, string> = {
  montage: "Edith refait le montage",
  effet: "Edith fait l’effet image par image",
  "2e version": "Edith essaie une autre version",
  rendu: "Edith fabrique la vidéo",
  relecture: "Edith relit tout",
  correction: "Edith corrige un détail",
};

export function PostReview({
  data,
  surface,
  whatsAppPrefix,
  cover,
  shareToFeed,
}: {
  data: ReviewData;
  /** In the app (menu, Edith's panel) or on the page opened from WhatsApp. */
  surface: "app" | "whatsapp";
  /** From WhatsApp, « Demander une modif » goes back to WhatsApp with her words after this. */
  whatsAppPrefix?: string;
  cover: PostCover | null;
  shareToFeed: boolean;
}) {
  const router = useRouter();
  const openDrawer = useFauveDrawer();
  const video = useRef<HTMLVideoElement>(null);
  /** « Modifier » open, on a scene. */
  const [editing, setEditing] = useState<EditStart | null>(null);
  const [editor, setEditor] = useState<EditorModule | null>(null);
  // The video is set aside while « Modifier » plays the montage in its frame: it follows the one shown again.
  const player = useReelPlayback(video, editing ? null : data.videoUrl);
  const spans = useMemo(() => timeline(data.plan), [data.plan]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Her caption as she writes it: « Publier » sends it, saved or not.
  const [caption, setCaption] = useState(data.captionShown);
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

  const ask = () => {
    if (surface === "whatsapp") {
      window.location.href = whatsappLink(whatsAppPrefix ?? "");
      return;
    }
    openDrawer({ postId: data.postId, title: data.title });
  };
  const edit = (from: EditStart) => {
    setError(null);
    setEditing(from);
    if (!editor) {
      import("./reel-editor").then(setEditor, () => {
        setEditing(null);
        setError("Le montage n’a pas pu s’ouvrir. Réessaie dans un instant.");
      });
    }
  };
  const closeEditor = (saved?: string) => {
    setEditing(null);
    if (saved) {
      setToast(saved);
      router.refresh();
    }
  };
  // « Demander à Edith » about one scene: her panel in the app, WhatsApp from its page.
  const askScene = (scene: number, label: string) => {
    setEditing(null);
    if (surface === "whatsapp") {
      window.location.href = whatsappLink(`${whatsAppPrefix ?? ""}${label.toLowerCase()} : `);
      return;
    }
    openDrawer({ postId: data.postId, title: data.title, scene, sceneLabel: label });
  };

  const where = data.platforms.length ? data.platforms.map((p) => (p === "tiktok" ? "TikTok" : "Instagram")).join(" et ") : "Instagram";

  const publish = () => {
    if (needsInstagram(data)) return setSheet("instagram");
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("intent", "validate");
      form.set("caption", caption);
      form.set("with_hashtags", "1");
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
  // Another version, with its video, becomes the one that goes out (free and instant).
  const switchTo = (version: number, message: string) =>
    start(async () => {
      setError(null);
      const result = await restoreVersion(data.postId, version);
      if (!result.ok) return setError(result.error);
      setToast(message);
      router.refresh();
    });

  const tile = "fauve-press flex h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[13.5px] font-extrabold disabled:opacity-60";
  const action = data.locked ? null : data.status === "scheduled" ? (
    <div className="flex items-start gap-3 rounded-[18px] bg-success-soft px-4 py-3.5 text-success">
      <CheckIcon size={20} className="mt-0.5 shrink-0" />
      <p className="text-[14.5px] leading-snug font-semibold">{`C’est parti : il part sur ${where}, Edith te dit quand il est en ligne.`}</p>
    </div>
  ) : data.making ? (
    <button type="button" disabled className="btn h-[54px] w-full bg-line text-[16px] text-muted">
      Edith finit la nouvelle version…
    </button>
  ) : (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={pending || !data.videoUrl}
          className={`${tile} bg-violet text-white shadow-[0_8px_22px_rgba(91,63,217,0.26)] hover:bg-violet-hover`}
        >
          <ArrowUpIcon size={19} />
          {pending ? "Un instant…" : data.publishByHand ? "Me l’envoyer" : "Publier"}
        </button>
        {data.downloadUrl ? (
          <a href={data.downloadUrl} download className={`${tile} border-[1.5px] border-line bg-white text-ink hover:border-lilac`}>
            <DownloadIcon size={19} />
            Télécharger
          </a>
        ) : (
          <button type="button" disabled className={`${tile} border-[1.5px] border-line bg-white text-ink`}>
            <DownloadIcon size={19} />
            Télécharger
          </button>
        )}
        <button type="button" onClick={() => setSheet("date")} className={`${tile} border-[1.5px] border-line bg-white text-ink hover:border-lilac`}>
          <CalendarIcon size={19} />
          Prévoir
        </button>
      </div>
      {data.upcoming && data.when && <p className="text-center text-[12.5px] font-semibold text-muted">Edith te fait signe {data.when.short} pour le poster.</p>}
    </div>
  );
  const askButton = !data.locked && (
    <button type="button" onClick={ask} className="btn btn-secondary h-[50px] w-full text-[16px] font-extrabold">
      <PenIcon size={18} />
      Modifier avec Edith
    </button>
  );
  // Its scenes, when it has several and its video is this version's: a tap changes that one.
  const strip = !data.locked && !data.making && !data.failed && Boolean(data.videoUrl) && !data.baked && data.plan.segments.length > 1;

  // « Modifier » open: the same page, each piece of the editor where its own was.
  if (editing) {
    const Editor = editor?.ReelEditor;
    return Editor ? (
      <Editor postId={data.postId} scenes={data.scenes} start={editing} onClose={closeEditor} onAsk={askScene} layout={page} />
    ) : (
      <OpeningEditor onClose={closeEditor} layout={page} />
    );
  }
  return page(null);

  function page(parts: EditorParts | null) {
    return (
      <div className="flex flex-col gap-5 pb-36 lg:pb-0">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          {/* The Reel as it will go out. */}
          <section aria-label="Aperçu" className="flex flex-col items-center gap-3 rounded-[24px] bg-soft px-4 py-5 lg:py-8">
            {parts ? (
              <p className="text-[13.5px] font-bold text-violet">Tu modifies une scène de ton Reel</p>
            ) : data.locked ? (
              <p className="text-[13.5px] font-bold text-success">Publié</p>
            ) : (
              !data.making && <Versions data={data} pending={pending} onSwitch={switchTo} />
            )}
            <div className="relative aspect-[9/16] w-[max(176px,min(280px,calc((100dvh-470px)*0.5625)))] overflow-hidden rounded-[22px] bg-ink shadow-[0_18px_44px_rgba(28,21,48,.18)] lg:w-[320px]">
              {parts?.preview ??
                (data.videoUrl && (
                  <>
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
                    <PausedSign playing={player.playing} />
                    {/* Play or pause, where it is (drag to go forward or back), its sound. */}
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
                  </>
                ))}
              {!parts && data.failed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 p-6 text-center text-white">
                  <span className="flex size-20 items-center justify-center rounded-full bg-white">
                    <Mascot size={64} mood="sad" />
                  </span>
                  <span className="text-[16px] font-extrabold">La vidéo n’a pas pu être fabriquée</span>
                  <span className="text-[13px] leading-snug text-white/85">Demande-le à Edith : il la relance.</span>
                </div>
              )}
              {!parts && !data.failed && (data.making || !data.videoUrl) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/65 p-6 text-center text-white">
                  <span className="flex size-20 items-center justify-center rounded-full bg-white">
                    <Mascot size={64} mood="thinking" />
                  </span>
                  <span className="text-[16px] font-extrabold">{data.making?.step ? (STEPS[data.making.step] ?? "Edith y travaille") : "La vidéo se met à jour"}</span>
                  <span className="text-[13px] leading-snug text-white/85">
                    {`Ça prend ${data.making?.step === "effet" ? EFFECT_MINUTES : data.making?.kind === "montage" ? REDO_MINUTES : RERENDER_MINUTES} minutes.`} Tu peux fermer, Edith te prévient.
                  </span>
                </div>
              )}
            </div>
            {/* Its scenes: a tap opens that one alone; while it is open, they choose the scene to change. */}
            {parts?.strip ? (
              <div className="flex w-full max-w-[340px] flex-col items-center gap-1">{parts.strip}</div>
            ) : (
              strip &&
              !parts && (
                <div className="flex w-full max-w-[340px] flex-col items-center gap-1">
                  <SceneStrip
                    segments={data.plan.segments}
                    sprite={data.scenes}
                    playing={spans.findIndex((s) => player.time >= s.start && player.time < s.end)}
                    onPick={(scene) => edit({ scene })}
                  />
                  <p className="text-[12px] font-semibold text-muted">Touche une scène pour modifier celle-là seulement</p>
                </div>
              )
            )}
          </section>

          {parts ? (
            // « Modifier »: the panel beside the video becomes the scene chosen.
            <aside aria-label="Modifier" className="flex flex-col gap-4 rounded-[24px] border border-line bg-white p-5">
              <div className="hidden lg:block">{parts.actions}</div>
              {parts.settings}
            </aside>
          ) : (
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
          )}
        </div>

        {/* Phone: the two buttons always at hand; « Annuler » / « Enregistrer » while a scene is open. */}
        {!data.locked && (
          <div
            className={`fixed inset-x-0 z-30 flex flex-col gap-2 border-t border-line bg-white/95 px-4 pt-3 pb-3 backdrop-blur lg:hidden ${surface === "app" ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]" : "bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"}`}
          >
            {parts ? (
              parts.actions
            ) : (
              <>
                {error && (
                  <p role="alert" className="text-center text-[13.5px] font-semibold text-danger">
                    {error}
                  </p>
                )}
                {action}
                {askButton}
              </>
            )}
          </div>
        )}

        <ReviewSheets sheet={sheet} data={data} onClose={() => setSheet(null)} onPlanned={planned} />

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
}

/** Which version goes out, and the way back to the one before (or forward again to the newer one). */
function Versions({ data, pending, onSwitch }: { data: ReviewData; pending: boolean; onSwitch: (version: number, message: string) => void }) {
  if (data.previous === null && data.next === null) return null;
  const at = data.versions.indexOf(data.version) + 1;
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13.5px] font-semibold">
      {data.previous !== null && (
        <button
          type="button"
          onClick={() => onSwitch(data.previous!, "Tu as retrouvé la version d’avant.")}
          disabled={pending}
          className="inline-flex items-center gap-1 font-bold text-violet underline underline-offset-3 disabled:opacity-60"
        >
          <UndoIcon size={15} />
          Revenir à l’ancienne
        </button>
      )}
      {at > 0 && data.versions.length > 1 && (
        <span className="text-muted">
          Version {at} sur {data.versions.length}
        </span>
      )}
      {data.next !== null && (
        <button
          type="button"
          onClick={() => onSwitch(data.next!, "Tu as repris la nouvelle version.")}
          disabled={pending}
          className="inline-flex items-center gap-1 font-bold text-violet underline underline-offset-3 disabled:opacity-60"
        >
          Reprendre la nouvelle
          <UndoIcon size={15} className="-scale-x-100" />
        </button>
      )}
    </p>
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
      form.set("with_hashtags", "1");
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
          placeholder="Edith l’écrit avec la vidéo."
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
