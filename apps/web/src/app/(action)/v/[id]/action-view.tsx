"use client";

import { coverSrc } from "@/lib/cover-src";
import { CoverPicker } from "@/components/montage/cover-picker";
import {
  buildCarouselProps,
  buildReelProps,
  buildSlideProps,
  DEFAULT_COVER_SECONDS,
  editPlanSchema,
  segmentKind,
  statusLabels,
  timeline,
  type EditPlan,
  type PostCover,
  type PostKind,
  type PostStatus,
  type ReelInputs,
  type CarouselPhoto,
  type SavedLook,
  type SlidesPlan,
} from "@fauve/agent";
import type { PlayerRef } from "@remotion/player";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { CheckIcon, PenIcon, PlusIcon, WhatsAppIcon } from "@/components/icons";
import { FormatBadge } from "@/components/format-badge";
import { CarouselWords } from "@/components/montage/carousel-words";
import { SlidePreview } from "@/components/montage/slide-preview";
import { SlidesEditor } from "@/components/montage/slides-editor";
import { TextBoxes } from "@/components/montage/text-boxes";
import { TextSheet } from "@/components/montage/text-sheet";
import { Orb } from "@/components/orb";
import { ReelPlayer } from "@/components/reel-player";
import { saveCarouselTexts, saveEditPlan, saveSlidesPlan, updatePost } from "@/app/(app)/publications/[id]/actions";

// The page a WhatsApp link opens, made for a phone: watch the montage, then one
// thumb away from validating it, moving a text, or asking Fauve for a change.

type Text = EditPlan["texts"][number];
type Mode = "view" | "edit" | "done";

const kindLabels: Record<PostKind, string> = { reel: "Reel", post: "Post", carousel: "Carrousel", story: "Story" };
const sceneLabels = { clip: "Vidéo", scene: "Écran", motion: "Animation" } as const;
const round = (n: number) => Math.round(n * 10) / 10;

export type ActionMedia = { url: string; video: boolean; at?: number };
export type GridTile = { url: string; reel: boolean; carousel: boolean };

export type ActionPost = {
  id: string;
  title: string;
  kind: PostKind;
  status: PostStatus;
  caption: string;
  hashtags: string[];
  when: string | null;
};

export function ActionView({
  post,
  editor,
  videoUrl,
  media,
  grid,
  slides,
  changeHref,
  backHref,
  looks = [],
  note = null,
  cover = null,
  shareToFeed = true,
}: {
  post: ActionPost;
  editor: { plan: EditPlan; inputs: ReelInputs } | null;
  videoUrl: string | null;
  /** The post's own photos and videos, in order (a carousel has several). */
  media: ActionMedia[];
  /** The latest Instagram posts, for the grid preview; null when it does not apply (story). */
  grid: GridTile[] | null;
  /** Text over the photos (carousel or photo post): the plan, the photos by media id, the brand; a composed carousel's photos in its order. */
  slides: { plan: SlidesPlan; photos: Record<string, string>; brand: ReelInputs["brand"]; carousel?: CarouselPhoto[] } | null;
  changeHref: string;
  backHref: string;
  /** The studio's saved text looks (copied by Fauve from examples, or kept by hand). */
  looks?: SavedLook[];
  /** What Fauve did and checked for this version (posts.agent_note), under the caption. */
  note?: string | null;
  /** A Reel's chosen cover (posts.cover). */
  cover?: PostCover | null;
  /** A Reel in the profile grid too, or only in the Reels tab. */
  shareToFeed?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("view");
  // The montage's photos, which can stand as the cover.
  const coverPhotos = (editor?.inputs.photoIds ?? []).flatMap((id) => (editor?.inputs.clipUrls[id] ? [{ id, url: editor.inputs.clipUrls[id]! }] : []));
  const coverPhoto = cover && "media_id" in cover ? coverPhotos.find((p) => p.id === cover.media_id) : undefined;
  const [inGrid, setInGrid] = useState(false);
  const [status, setStatus] = useState(post.status);
  const [saved, setSaved] = useState(editor?.plan ?? null);
  const [plan, setPlan] = useState(editor?.plan ?? null);
  const [savedSlides, setSavedSlides] = useState(slides?.plan ?? null);
  const [slidePlan, setSlidePlan] = useState(slides?.plan ?? null);
  // A carousel Simone composed: its words change here, slide by slide; its layout by asking her.
  const design = slides?.plan.design ?? null;
  const [savedWords, setSavedWords] = useState(design?.texts ?? {});
  const [words, setWords] = useState(design?.texts ?? {});
  const [wordsSlide, setWordsSlide] = useState(0);
  const [caption, setCaption] = useState(post.caption);
  const [savedCaption, setSavedCaption] = useState(post.caption);
  const [editingCaption, setEditingCaption] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [scene, setScene] = useState(0);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const playerRef = useRef<PlayerRef>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const props = useMemo(() => (plan && editor ? buildReelProps(plan, editor.inputs) : null), [plan, editor]);
  const spans = useMemo(() => (plan ? timeline(plan) : []), [plan]);
  const dirty = plan !== null && JSON.stringify(plan) !== JSON.stringify(saved);
  const valid = plan === null || editPlanSchema.safeParse(plan).success;
  const canValidate = status === "draft";
  const editable = (editor !== null || slides !== null) && status !== "published" && status !== "measured";
  const slidesDirty = design ? JSON.stringify(words) !== JSON.stringify(savedWords) : slidePlan !== null && JSON.stringify(slidePlan) !== JSON.stringify(savedSlides);
  const composedProps = (slide: number) => (design && slides ? buildCarouselProps({ ...design, texts: words }, slide, { template: slides.plan.template, brand: slides.brand, photos: slides.carousel ?? [] }) : null);

  const seek = (seconds: number) => props && playerRef.current?.seekTo(Math.round(seconds * props.fps));
  const setText = (i: number, patch: Partial<Text>) => {
    if (!plan) return;
    setPlan({ ...plan, texts: plan.texts.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
    setToast(null);
  };
  const pick = (i: number) => {
    setActive(i);
    playerRef.current?.pause();
  };
  const pickScene = (i: number) => {
    setScene(i);
    setActive(null);
    const span = spans[i];
    if (span) seek(Math.min(span.start + 1, (span.start + span.end) / 2));
    playerRef.current?.pause();
  };
  const addText = () => {
    if (!plan) return;
    const span = spans[Math.min(scene, spans.length - 1)] ?? { start: 0, end: plan.duration };
    const text: Text = { text: "Ton texte", from: round(span.start), to: round(Math.min(span.end, span.start + 2.5)), style: "band" };
    setPlan({ ...plan, texts: [...plan.texts, text] });
    setActive(plan.texts.length);
    seek(text.from + 0.3);
  };
  const removeText = (i: number) => {
    if (!plan) return;
    setPlan({ ...plan, texts: plan.texts.filter((_, j) => j !== i) });
    setActive(null);
  };

  const cancelEdit = () => {
    setPlan(saved);
    setSlidePlan(savedSlides);
    setWords(savedWords);
    setActive(null);
    setMode("view");
  };
  const saveEdit = () =>
    start(async () => {
      if (design) {
        const changed = Object.fromEntries(Object.entries(words).filter(([k, v]) => savedWords[k] !== v));
        const res = await saveCarouselTexts(post.id, changed).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
        if (!res.ok) return setToast({ ok: false, text: res.error });
        setSavedWords(words);
        setMode("view");
        setToast({ ok: true, text: "C’est enregistré. Les images finales se mettent à jour en une minute environ." });
        return;
      }
      if (slides && slidePlan) {
        const res = await saveSlidesPlan(post.id, slidePlan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
        if (!res.ok) return setToast({ ok: false, text: res.error });
        setSavedSlides(slidePlan);
        setMode("view");
        setToast({ ok: true, text: "C’est enregistré. Les images finales se mettent à jour en une minute environ." });
        return;
      }
      if (!plan) return;
      const res = await saveEditPlan(post.id, plan).catch(() => ({ ok: false as const, error: "L’enregistrement a échoué. Réessaie." }));
      if (!res.ok) return setToast({ ok: false, text: res.error });
      setSaved(plan);
      setActive(null);
      setMode("view");
      setToast({ ok: true, text: "C’est enregistré. La vidéo finale se met à jour en une minute environ." });
    });

  const submit = (intent: "validate" | "save") =>
    start(async () => {
      const form = new FormData();
      form.set("intent", intent);
      form.set("caption", caption);
      const res = await updatePost(post.id, { status: "idle" }, form).catch(() => ({
        status: "error" as const,
        message: "Ça n’a pas marché. Réessaie dans un instant.",
      }));
      if (res.status === "error") return setToast({ ok: false, text: res.message });
      if (res.status !== "ok") return;
      setSavedCaption(caption);
      setEditingCaption(false);
      if (intent === "validate") {
        setStatus("validated");
        setDone(res.message);
        setMode("done");
      } else setToast({ ok: true, text: res.message });
    });

  if (mode === "done") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-violet text-white shadow-[0_0_0_10px_rgba(91,63,217,0.25)]">
          <CheckIcon size={30} />
        </span>
        <h1 className="font-serif text-[34px] italic leading-tight">C’est validé</h1>
        <p className="max-w-[320px] text-[16px] leading-relaxed text-white/75">{done}</p>
        <a href={backHref} className="mt-2 flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-bold text-ink">
          <WhatsAppIcon size={18} /> Retour à WhatsApp
        </a>
        <button type="button" onClick={() => setMode("view")} className="text-[14px] font-semibold text-white/60 underline-offset-4 hover:underline">
          Revoir la publication
        </button>
      </main>
    );
  }

  const editingSlides = mode === "edit" && slides !== null && slidePlan !== null;
  const editing = mode === "edit" && !editingSlides && plan !== null;
  // The photos as published: with their texts when there are some (drawn live); a composed carousel, its slides.
  const slideNodes = design
    ? Array.from({ length: design.count }, (_, i): ReactNode => <SlidePreview key={i} props={composedProps(i)!} />)
    : slides && slidePlan?.slides.some((s) => s.texts.length)
      ? slidePlan.slides.map((s, i): ReactNode => {
          const url = slides.photos[s.media_id];
          return url ? (
            <SlidePreview props={buildSlideProps(s, { template: slidePlan.template, imageUrl: url, brand: slides.brand })} />
          ) : media[i]?.video ? (
            <video src={media[i]!.url} controls playsInline preload="metadata" className="size-full object-cover" />
          ) : null;
        })
      : undefined;
  const activeText = editing && active !== null ? plan.texts[active] : undefined;
  const sceneIndex = Math.min(scene, Math.max(0, spans.length - 1));
  const span = spans[sceneIndex];
  const sceneTexts = editing && span ? plan.texts.map((t, i) => ({ t, i })).filter(({ t }) => t.from >= span.start && t.from < span.end) : [];
  // The preview leaves room for the controls under it, so everything fits one screen.
  // Photos keep the feed's 4:5, a montage or a story is 9:16.
  // A composed carousel shows its slides (drawn live), not its photos.
  const shown: ActionMedia[] = design ? Array.from({ length: design.count }, () => ({ url: "", video: false })) : media;
  const photos = !props && !videoUrl && shown.length > 0 && post.kind !== "story";
  const ratio = photos ? 4 / 5 : 9 / 16;
  const mediaWidth = editing
    ? "min(100%, max(190px, calc((100dvh - 440px) * 9 / 16)))"
    : `min(100%, calc((100dvh - ${grid ? 390 : 340}px) * ${ratio}))`;
  const showGrid = inGrid && !editing && !editingSlides && grid !== null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+132px)]">
      <header className="flex items-center gap-3">
        <Orb size={30} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{post.title}</p>
          <p className="truncate text-[12px] text-white/60">
            {kindLabels[post.kind]}
            {post.when ? ` · ${post.when}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/80">{statusLabels[status].label}</span>
      </header>

      {editing && (
        <p className="mt-3 text-center text-[13px] text-white/70">
          {activeText ? "Glisse le texte avec le doigt, ou change-le en bas." : "Touche un texte pour le modifier, glisse-le pour le déplacer."}
        </p>
      )}

      {grid && !editing && !editingSlides && (
        <div role="tablist" aria-label="Aperçu" className="mt-3 flex self-center rounded-full bg-white/10 p-1">
          {[
            { on: !inGrid, label: "Publication", set: false },
            { on: inGrid, label: "Dans ta grille", set: true },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={tab.on}
              onClick={() => {
                setInGrid(tab.set);
                playerRef.current?.pause();
              }}
              className={`rounded-full px-4 py-1.5 text-[13px] font-bold ${tab.on ? "bg-white text-ink" : "text-white/70"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {showGrid && <GridPreview cover={coverPhoto ? { url: coverPhoto.url, video: false } : videoUrl ? { url: videoUrl, video: true, at: cover && "at" in cover ? cover.at : DEFAULT_COVER_SECONDS } : (media[0] ?? null)} coverNode={slideNodes?.[0]} kind={post.kind} tiles={grid} />}

      {editingSlides && design && (
        <section aria-label="Les textes du carrousel" className="mt-3 flex flex-col gap-3">
          <div className="mx-auto overflow-hidden rounded-[18px]" style={{ width: "min(100%, max(200px, calc((100dvh - 520px) * 4 / 5)))" }}>
            <SlidePreview props={composedProps(wordsSlide)!} />
          </div>
          {design.count > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {Array.from({ length: design.count }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWordsSlide(i)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${i === wordsSlide ? "bg-white text-ink" : "bg-white/10 text-white/80"}`}
                >
                  Image {i + 1}
                </button>
              ))}
            </div>
          )}
          <CarouselWords
            design={design}
            slide={wordsSlide}
            texts={words}
            dark
            onChange={(slot, text) => {
              setWords((w) => ({ ...w, [slot]: text }));
              setToast(null);
            }}
          />
          <p className="text-[12px] leading-snug text-white/50">La mise en page ou une image de plus : demande-le à Simone sur WhatsApp.</p>
        </section>
      )}

      {editingSlides && !design && (
        <section aria-label="Texte sur les photos" className="mt-3">
          <SlidesEditor
            plan={slidePlan}
            onChange={(next) => {
              setSlidePlan(next);
              setToast(null);
            }}
            photos={slides.photos}
            brand={slides.brand}
            looks={looks}
            dark
            previewWidth="min(100%, max(200px, calc((100dvh - 470px) * 4 / 5)))"
          />
        </section>
      )}

      <div className={`mt-3 justify-center ${showGrid || editingSlides ? "hidden" : "flex"}`}>
        <div ref={previewRef} className="relative overflow-hidden rounded-[22px] bg-black" style={{ width: mediaWidth }}>
          {props ? (
            <>
              {/* Opens a second in: at frame 0 the texts have not come in yet. */}
              <ReelPlayer props={props} playerRef={playerRef} initialFrame={Math.min(props.fps, props.durationInFrames - 1)} />
              {editing && (
                <TextBoxes
                  container={previewRef}
                  player={playerRef}
                  texts={plan.texts}
                  active={active}
                  // Her hand's place: the engine leaves it where she put it from now on.
                  onMove={(i, place) => setText(i, { ...place, auto_y: undefined })}
                  onEdit={(i, text) => setText(i, { text })}
                  onPick={pick}
                />
              )}
            </>
          ) : videoUrl ? (
            <video src={videoUrl} controls playsInline loop className="aspect-[9/16] w-full object-cover" />
          ) : shown.length > 0 ? (
            <MediaSlides media={shown} nodes={slideNodes} ratio={post.kind === "story" ? "aspect-[9/16]" : "aspect-[4/5]"} />
          ) : (
            <div className="flex aspect-[9/16] w-full items-center justify-center p-6 text-center text-[14px] text-white/60">
              Simone prépare encore cette publication.
            </div>
          )}
        </div>
      </div>

      {editingSlides ? null : editing ? (
        <section aria-label="Modifier" className="mt-4 flex flex-col gap-3">
          {plan.segments.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {plan.segments.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickScene(i)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                    i === sceneIndex ? "bg-white text-ink" : "bg-white/10 text-white/80"
                  }`}
                >
                  {i + 1}. {sceneLabels[segmentKind(s)]}
                </button>
              ))}
            </div>
          )}

          {activeText && active !== null ? (
            <TextSheet
              key={active}
              text={activeText}
              onChange={(patch) => setText(active, patch)}
              onRemove={() => removeText(active)}
              onClose={() => setActive(null)}
              looks={props ? { saved: looks, brand: props.brand } : undefined}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {sceneTexts.map(({ t, i }) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    pick(i);
                    seek(t.from + 0.3);
                  }}
                  className="flex max-w-full items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[13px]"
                >
                  <PenIcon size={13} className="shrink-0 text-white/60" />
                  <span className="truncate">{t.text}</span>
                </button>
              ))}
              <button type="button" onClick={addText} className="flex items-center gap-1.5 rounded-full border border-dashed border-white/30 px-3 py-1.5 text-[13px] text-white/80">
                <PlusIcon size={13} /> Ajouter un texte
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
        {post.kind === "reel" && videoUrl && editor && (
          <div className="mt-4 rounded-[16px] bg-white text-ink">
            <CoverPicker postId={post.id} videoUrl={videoUrl} initial={cover} defaultAt={DEFAULT_COVER_SECONDS} photos={coverPhotos} initialShareToFeed={shareToFeed} />
          </div>
        )}
        <section aria-label="Légende" className="mt-4">
          {editingCaption ? (
            <textarea
              autoFocus
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              maxLength={2200}
              className="w-full rounded-[16px] bg-white p-3.5 text-[15px] leading-relaxed text-ink outline-none focus:ring-2 focus:ring-violet"
            />
          ) : (
            <button
              type="button"
              disabled={!editable && !canValidate}
              onClick={() => setEditingCaption(true)}
              className="w-full rounded-[16px] bg-white/[0.07] p-3.5 text-left text-[14px] leading-relaxed text-white/85"
            >
              <span className="line-clamp-3 whitespace-pre-line">{caption || "Pas encore de légende."}</span>
              {post.hashtags.length > 0 && <span className="mt-1.5 block truncate text-violet-soft/80">{post.hashtags.map((h) => `#${h}`).join(" ")}</span>}
              {(editable || canValidate) && (
                <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-white/50">
                  <PenIcon size={12} /> Modifier la légende
                </span>
              )}
            </button>
          )}
        </section>
        </>
      )}

      {note && !editing && !editingSlides && !showGrid && (
        <div className="mt-3 flex items-start gap-2.5 rounded-[16px] border border-white/10 p-3">
          <Orb size={20} className="mt-0.5" />
          <p className="text-[13px] leading-snug text-white/70">{note}</p>
        </div>
      )}

      {toast && (
        <p
          key={toast.text}
          role="status"
          className={`fauve-enter mt-3 rounded-[14px] px-3.5 py-2.5 text-[14px] ${toast.ok ? "bg-white/10 text-white" : "bg-peach text-peach-ink"}`}
        >
          {toast.text}
        </p>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {editing || editingSlides ? (
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} className="flex-1 rounded-full border border-white/25 py-3.5 text-[15px] font-bold">
                Annuler
              </button>
              <button
                type="button"
                disabled={(editingSlides ? !slidesDirty : !dirty || !valid) || pending}
                onClick={saveEdit}
                className="flex-[2] rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-40"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {editable && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("edit");
                      pickScene(0);
                      setToast(null);
                      setEditingCaption(false);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/25 py-3.5 text-[15px] font-bold"
                  >
                    <PenIcon size={16} /> Modifier
                  </button>
                )}
                {canValidate ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit("validate")}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-50"
                  >
                    <CheckIcon size={18} /> {pending ? "Validation…" : "Valider"}
                  </button>
                ) : caption !== savedCaption ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit("save")}
                    className="flex-[2] rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-50"
                  >
                    Enregistrer la légende
                  </button>
                ) : (
                  <p className="flex flex-[2] items-center justify-center rounded-full bg-white/10 px-3 py-3.5 text-center text-[14px] font-semibold text-white/80">
                    {status === "validated" || status === "scheduled" ? "Déjà validée" : statusLabels[status].label}
                  </p>
                )}
              </div>
              <a href={changeHref} className="flex items-center justify-center gap-1.5 py-1 text-[13px] font-semibold text-white/65">
                <WhatsAppIcon size={14} /> Demander un changement à Simone
              </a>
            </>
          )}
        </div>
      </nav>
    </main>
  );
}


/** The photos of a post, swiped one by one like on Instagram, with a counter and dots. */
function MediaSlides({ media, nodes, ratio }: { media: ActionMedia[]; nodes?: ReactNode[]; ratio: string }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLUListElement>(null);
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className={`flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] ${ratio}`}
        aria-label={media.length > 1 ? `Carrousel de ${media.length} éléments` : "Aperçu"}
      >
        {media.map((m, i) => (
          <li key={i} className="h-full w-full shrink-0 snap-center">
            {nodes?.[i] ? (
              nodes[i]
            ) : m.video ? (
              <video src={m.url} controls playsInline preload="metadata" className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
              <img src={m.url} alt="" className="size-full object-cover" />
            )}
          </li>
        ))}
      </ul>
      {media.length > 1 && (
        <>
          <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold">
            {index + 1}/{media.length}
          </span>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => go(i)}
                className={`size-2 rounded-full ${i === index ? "bg-white" : "bg-white/45"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The post at the top of the Instagram grid, before the latest ones: how the feed will look. */
function GridPreview({
  cover,
  coverNode,
  kind,
  tiles,
}: {
  cover: ActionMedia | null;
  /** The first slide with its text, when it has some. */
  coverNode?: ReactNode;
  kind: PostKind;
  tiles: GridTile[];
}) {
  return (
    <section aria-label="Dans ta grille" className="mt-3 flex flex-col gap-2">
      <ul className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-[18px] bg-white/5">
        <li className="relative aspect-[3/4] overflow-hidden bg-white/10">
          {coverNode ? (
            // A 4:5 slide in a 3:4 tile: centred, cropped at the sides like Instagram does.
            <div className="absolute inset-y-0 left-1/2 aspect-[4/5] h-full -translate-x-1/2">{coverNode}</div>
          ) : cover?.video ? (
            <video src={coverSrc(cover)} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
            <img src={cover.url} alt="" className="size-full object-cover" />
          ) : null}
          <span className="pointer-events-none absolute inset-0 border-2 border-violet" />
          <span className="absolute top-1.5 left-1.5 rounded-full bg-violet px-2 py-0.5 text-[10px] font-bold">Nouveau</span>
          <FormatBadge format={kind} small />
        </li>
        {tiles.map((t, i) => (
          <li key={i} className="relative aspect-[3/4] bg-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN */}
            <img src={t.url} alt="" loading="lazy" className="size-full object-cover" />
            <FormatBadge format={t.reel ? "reel" : t.carousel ? "carousel" : null} small />
          </li>
        ))}
      </ul>
      {tiles.length === 0 && <p className="text-center text-[13px] text-white/60">Connecte Instagram pour voir tes dernières publications autour.</p>}
    </section>
  );
}
