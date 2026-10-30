"use client";

import { buildCarouselProps, buildSlideProps, statusLabels, type SavedLook, type SlidesPlan } from "@fauve/agent";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveCarouselTexts, saveSlidesPlan, updatePost } from "@/app/(app)/publications/[id]/actions";
import { ArrowLeftIcon, ArrowUpIcon, CalendarIcon, CaptionIcon, CheckIcon, DownloadIcon, InstagramIcon, PenIcon, ShareIcon, TypeIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { CarouselStudio } from "@/components/montage/carousel-studio";
import { SlidePreview } from "@/components/montage/slide-preview";
import { SlidesEditor } from "@/components/montage/slides-editor";
import { Orb } from "@/components/orb";
import type { CarouselReviewData } from "@/lib/carousel-review";
import { whatsappLink } from "@/lib/public-env";
import { DateView } from "./change-panel";
import { Sheet } from "./review-sheets";

// A carousel or a photo post opened from WhatsApp (/v/{id}), made for her phone like its Reel
// page (Tristan: « l'interface page mobile pour carrousel est pas ouf »): the slides large, as the
// feed shows them, swiped one by one, the dots under them (over the image, they sat on its last
// line); its caption, touched, opens to be written over; and the same buttons as a Reel: publish
// it, save its images, choose when Edith reminds her to post it, tell Edith what to change. Its
// words change on the image itself (« Changer un texte »), as on its page in the app.

type Sheets = "caption" | "date" | "publish" | "save";

/** Composing it, in her words (its job's steps). */
const MAKING: Record<string, string> = { design: "Je compose ton carrousel", review: "Je relis chaque image", fix: "Je corrige un détail" };

export function PhoneCarousel({ data, looks = [] }: { data: CarouselReviewData; looks?: SavedLook[] }) {
  const router = useRouter();
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<Sheets | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  // Her words just saved: their final images are made after the answer, the page follows them a few minutes.
  const [waiting, setWaiting] = useState(false);

  // Her caption as she writes it, as Instagram will show it (hashtags included).
  const [caption, setCaption] = useState(data.captionShown);
  const [savedCaption, setSavedCaption] = useState(data.captionShown);
  // Her words on the images: a composed carousel's, or her texts on the photos. Each follows what
  // was saved since (by her or Edith) while she is not changing it.
  const serverWords = data.design?.design.texts ?? {};
  const serverPlan = data.plan?.plan ?? null;
  const [words, setWords] = useState(serverWords);
  const [plan, setPlan] = useState<SlidesPlan | null>(serverPlan);
  const [seen, setSeen] = useState({ caption: data.captionShown, words: JSON.stringify(serverWords), plan: JSON.stringify(serverPlan) });
  const now = { caption: data.captionShown, words: JSON.stringify(serverWords), plan: JSON.stringify(serverPlan) };
  if (now.caption !== seen.caption || now.words !== seen.words || now.plan !== seen.plan) {
    setSeen(now);
    setSavedCaption(data.captionShown);
    if (sheet !== "caption") setCaption(data.captionShown);
    if (!editing) {
      setWords(serverWords);
      setPlan(serverPlan);
    }
  }
  const captionEdited = caption.trim() !== data.captionShown.trim();
  const wordsChanged = JSON.stringify(words) !== now.words;
  const planChanged = JSON.stringify(plan) !== now.plan;

  // Edith composing it, or its final images made again: the page follows until they are there.
  if (waiting && data.downloads.length && !wordsChanged && !planChanged) setWaiting(false);
  useEffect(() => {
    if (!data.making && !data.updating && !waiting) return;
    const timer = setInterval(() => router.refresh(), 12_000);
    const enough = waiting ? setTimeout(() => setWaiting(false), 4 * 60_000) : undefined;
    return () => {
      clearInterval(timer);
      clearTimeout(enough);
    };
  }, [data.making, data.updating, waiting, router]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  // Back from changing a text, on the slide she was on.
  useEffect(() => {
    const el = track.current;
    if (!editing && el) el.scrollTo({ left: index * el.clientWidth });
    // Only when the strip comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const count = Math.max(data.count, data.design?.design.count ?? 0);
  const design = data.design;
  /** A slide as it will be published: its final image, or drawn live (her words not made into images yet). */
  const slide = (i: number) => {
    const shown = data.slides[i];
    if (shown && !(design && wordsChanged) && !(data.plan && planChanged)) {
      return shown.video ? (
        <video src={shown.url} controls playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
        <img src={shown.url} alt={`Image ${i + 1}`} className="size-full object-cover" draggable={false} />
      );
    }
    if (design) return <SlidePreview props={buildCarouselProps({ ...design.design, texts: words }, i, { template: design.template, brand: data.brand, photos: design.photos })} />;
    const id = data.mediaIds[i];
    const s = plan?.slides.find((x) => x.media_id === id);
    const url = id ? data.plan?.photos[id] : undefined;
    if (s && url && plan) return <SlidePreview props={buildSlideProps(s, { template: plan.template, imageUrl: url, brand: data.brand })} />;
    return <div className="size-full bg-white/5" />;
  };

  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  const canChange = !data.locked && !data.making && (design !== null || plan !== null);
  // A photo with no text yet: she adds one.
  const changeLabel = design || plan?.slides.some((s) => s.texts.length) ? "Changer un texte" : "Ajouter un texte";
  const canPublish = data.status === "draft" || data.status === "validated";
  const sent = data.status === "scheduled";
  const where = data.platforms.length ? data.platforms.map((p) => (p === "tiktok" ? "TikTok" : "Instagram")).join(" et ") : "Instagram";
  const needsInstagram = !data.instagram && (!data.platforms.length || data.platforms.includes("instagram"));
  const many = count > 1;
  const noun = data.kind === "carousel" ? "ton carrousel" : "ta photo";
  const line = data.locked
    ? "Publié"
    : data.making
      ? "Une nouvelle version arrive"
      : sent
        ? "En route"
        : data.updating
          ? "Les images se mettent à jour"
          : canPublish
            ? "Prêt à publier"
            : statusLabels[data.status].label;

  const publish = () => {
    // Not connected: she posts it herself, her images shared from her phone with her caption copied.
    if (needsInstagram) return setSheet("publish");
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("intent", "validate");
      form.set("caption", captionEdited ? caption : data.caption);
      if (captionEdited) form.set("with_hashtags", "1");
      const result = await updatePost(data.postId, { status: "idle" }, form);
      if (result.status === "error") return setError(result.message);
      if (result.status === "ok") setToast(result.message);
      router.refresh();
    });
  };
  // Closed (outside, its cross), its sheet keeps what she wrote, saved as « Enregistrer » does; only « Annuler » puts it back.
  const keepCaption = () => {
    if (pending) return;
    if (!captionEdited) return setSheet(null);
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("intent", "save");
      form.set("caption", caption);
      form.set("with_hashtags", "1");
      const result = await updatePost(data.postId, { status: "idle" }, form).catch((reason: unknown) => {
        unstable_rethrow(reason);
        return { status: "error" as const, message: "L’enregistrement a échoué. Vérifie ta connexion et réessaie." };
      });
      if (result.status === "error") return setError(result.message);
      setSheet(null);
      setSavedCaption(caption);
      if (result.status === "ok") setToast(result.message);
      router.refresh();
    });
  };
  const dropCaption = () => {
    setCaption(savedCaption);
    setError(null);
    setSheet(null);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setSheet("caption");
    }
  };
  const cancelWords = () => {
    setWords(serverWords);
    setPlan(serverPlan);
    setError(null);
    setEditing(false);
  };
  const saveWords = () =>
    start(async () => {
      setError(null);
      const failed = { ok: false as const, error: "L’enregistrement a échoué. Vérifie ta connexion et réessaie." };
      const result = design
        ? await saveCarouselTexts(data.postId, Object.fromEntries(Object.entries(words).filter(([k, v]) => serverWords[k] !== v))).catch(() => failed)
        : plan
          ? await saveSlidesPlan(data.postId, plan).catch(() => failed)
          : failed;
      if (!result.ok) return setError(result.error);
      setEditing(false);
      setWaiting(true);
      setToast("C’est enregistré. Les images finales se mettent à jour en une minute environ.");
      router.refresh();
    });

  // Composing it: its photos alone are not what she will see.
  if (data.making && !design) return <Making title={data.title} step={data.making.step} minutes={data.making.minutes} />;

  const tile = "flex h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[13px] font-extrabold disabled:opacity-45";
  const dirty = design ? wordsChanged : planChanged;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col pb-[calc(env(safe-area-inset-bottom)+140px)]">
      {/* Top: back to WhatsApp, and whose post it is, as the feed shows it. */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 bg-ink/90 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur">
        <a href={whatsappLink("")} aria-label="Retourner sur WhatsApp" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
          <ArrowLeftIcon size={19} />
        </a>
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
          {data.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
            <img src={data.brand.logoUrl} alt="" className="size-full object-contain p-1" />
          ) : (
            <Orb size={36} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14.5px] leading-tight font-extrabold">{data.handle || data.brand.name || data.title}</span>
          <span className="truncate text-[12.5px] text-white/60">{line}</span>
        </span>
      </header>

      {editing && design ? (
        // Her words, on the image itself.
        <section aria-label="Changer les textes" className="mt-2 flex flex-col items-center gap-2 px-4">
          <div className="w-full" style={{ maxWidth: "min(100%, max(240px, calc((100dvh - 255px) * 4 / 5)))" }}>
            <CarouselStudio
              design={design.design}
              texts={words}
              onChange={(name, text) => {
                setWords((w) => ({ ...w, [name]: text }));
                setError(null);
              }}
              template={design.template}
              brand={data.brand}
              photos={design.photos}
              slide={Math.min(index, design.design.count - 1)}
              onSlide={setIndex}
              canEdit
              dark
            />
          </div>
          <a href={whatsappLink(`Pour « ${data.title} », image ${index + 1} : `)} className="flex items-center justify-center gap-1.5 py-1 text-[13px] font-semibold text-white/65">
            <PenIcon size={14} /> Demander autre chose à Edith pour cette image
          </a>
        </section>
      ) : editing && plan && data.plan ? (
        <section aria-label="Changer les textes" className="mt-2 px-4">
          <SlidesEditor
            plan={plan}
            onChange={(next) => {
              setPlan(next);
              setError(null);
            }}
            photos={data.plan.photos}
            brand={data.brand}
            looks={looks}
            dark
            previewWidth="min(100%, max(200px, calc((100dvh - 470px) * 4 / 5)))"
          />
        </section>
      ) : count ? (
        <>
          {/* The slides as the feed shows them, swiped one by one; sized to leave the buttons in view. */}
          <div className="relative mx-auto w-full" style={{ maxWidth: "min(100%, calc((100dvh - 232px) * 4 / 5))" }}>
            <ul
              ref={track}
              onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
              className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto bg-black [scrollbar-width:none]"
              aria-label={many ? `${data.kind === "carousel" ? "Carrousel" : "Publication"} de ${count} images` : "Ta publication"}
            >
              {Array.from({ length: count }, (_, i) => (
                <li key={i} className="h-full w-full shrink-0 snap-center overflow-hidden">
                  {slide(i)}
                </li>
              ))}
            </ul>
            {/* Shown when the slide changes, then gone: it would hide the corner of the image. */}
            {many && (
              <span key={index} className="fauve-counter pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold">
                {index + 1}/{count}
              </span>
            )}
          </div>
          {/* Under the image, as on Instagram: never over its last line. */}
          <div className="grid h-10 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
            <span />
            {many ? (
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Les images">
                {Array.from({ length: count }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Image ${i + 1}`}
                    onClick={() => go(i)}
                    className={`size-[7px] rounded-full transition-colors ${i === index ? "bg-violet-soft" : "bg-white/30"}`}
                  />
                ))}
              </div>
            ) : (
              <span />
            )}
            {canChange && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setToast(null);
                  setError(null);
                }}
                aria-label={changeLabel}
                className="flex h-8 items-center gap-1.5 justify-self-end rounded-full bg-white/10 px-3 text-[13px] font-bold"
              >
                {/* Beside many dots, the icon alone. */}
                <TypeIcon size={14} className="shrink-0" />
                {count <= 6 && changeLabel}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mx-4 mt-3 flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-[22px] bg-white/5 px-8 text-center">
          <Orb size={48} />
          <p className="text-[14.5px] leading-snug text-white/75">J’attends encore tes photos pour {noun}. Envoie-les-moi sur WhatsApp.</p>
        </div>
      )}

      {!editing && (
        <section aria-label="Légende" className="flex flex-col gap-1.5 px-4">
          {caption.trim() ? (
            <button type="button" onClick={() => (data.locked ? copy(caption) : setSheet("caption"))} className="text-left text-[14px] leading-snug">
              {data.handle && <strong className="font-extrabold">{data.handle} </strong>}
              <span className="line-clamp-3 whitespace-pre-line text-white/90">{caption}</span>
            </button>
          ) : null}
          {data.locked ? (
            caption.trim() && (
              <button type="button" onClick={() => copy(caption)} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-white/70">
                {copied ? <CheckIcon size={14} /> : <CaptionIcon size={14} />}
                {copied ? "Légende copiée" : "Copier la légende"}
              </button>
            )
          ) : (
            <button type="button" onClick={() => setSheet("caption")} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-white/70">
              <PenIcon size={13} />
              {caption.trim() ? "Modifier la légende" : "Écrire la légende"}
            </button>
          )}
          {!data.locked && !sent && data.upcoming && data.when && <p className="mt-1 text-[13px] text-white/55">Je te fais signe {data.when.short} pour le poster.</p>}
        </section>
      )}

      {toast && (
        <p role="status" className="fauve-enter fixed inset-x-4 top-[calc(4rem+env(safe-area-inset-top))] z-30 mx-auto max-w-[440px] rounded-[18px] bg-white px-4 py-3 text-center text-[14px] font-bold text-ink shadow-lg">
          {toast}
        </p>
      )}

      {/* What she does, always in reach. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {error && (
            <p role="alert" className="rounded-[14px] bg-danger px-3 py-2 text-[13.5px] font-semibold">
              {error}
            </p>
          )}
          {editing ? (
            <div className="flex gap-2">
              <button type="button" onClick={cancelWords} disabled={pending} className="flex-1 rounded-full border border-white/25 py-3.5 text-[15px] font-bold">
                Annuler
              </button>
              <button type="button" onClick={saveWords} disabled={!dirty || pending} className="flex-[2] rounded-full bg-violet py-3.5 text-[15px] font-bold disabled:opacity-40">
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          ) : (
            <>
              {data.locked ? (
                <SaveButton data={data} className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-white/15 text-[15px] font-extrabold disabled:opacity-45" onMany={() => setSheet("save")} />
              ) : sent ? (
                <p className="flex items-start gap-2 rounded-[18px] bg-white/10 px-4 py-3 text-[14.5px] leading-snug font-semibold">
                  <CheckIcon size={19} className="mt-0.5 shrink-0" />
                  {`C’est parti sur ${where}, je te dis quand c’est en ligne.`}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={publish} disabled={pending || !canPublish || !count} className={`${tile} bg-violet shadow-[0_8px_22px_rgba(91,63,217,0.4)]`}>
                    <ArrowUpIcon size={19} />
                    {pending ? "Un instant…" : "Publier"}
                  </button>
                  <SaveButton data={data} className={`${tile} bg-white/12`} onMany={() => setSheet("save")} />
                  <button type="button" onClick={() => setSheet("date")} className={`${tile} bg-white/12`}>
                    <CalendarIcon size={19} />
                    Prévoir
                  </button>
                </div>
              )}
              {!data.locked && (
                <a href={whatsappLink(`Pour « ${data.title} » : `)} className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-white/12 text-[15px] font-extrabold">
                  <PenIcon size={17} /> Modifier avec Edith
                </a>
              )}
            </>
          )}
        </div>
      </nav>

      {sheet === "caption" && (
        <Sheet title="Ta légende" hint={`Telle qu’elle partira avec ${noun}.`} onClose={keepCaption}>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={8}
            aria-label="Ta légende"
            placeholder="Edith l’écrit avec les images."
            readOnly={data.locked}
            // 16 px: under it, the phone zooms into the page as soon as she touches it.
            className="w-full resize-none rounded-[14px] border-[1.5px] border-line bg-white px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-violet"
          />
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
          {captionEdited && (
            <div className="flex gap-2">
              <button type="button" onClick={keepCaption} disabled={pending} className="btn btn-primary flex-1 disabled:opacity-60">
                {pending ? "Un instant…" : "Enregistrer"}
              </button>
              <button type="button" onClick={dropCaption} disabled={pending} className="btn btn-secondary">
                Annuler
              </button>
            </div>
          )}
          <button type="button" onClick={() => copy(caption)} className="inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-violet">
            {copied ? <CheckIcon size={15} /> : <CaptionIcon size={15} />}
            {copied ? "Légende copiée" : "Copier la légende"}
          </button>
        </Sheet>
      )}
      {sheet === "date" && (
        <Sheet title="Quand te faire signe ?" hint="Edith te rappelle de le poster à ce moment-là, sur WhatsApp et dans l’app." onClose={() => setSheet(null)}>
          <DateView
            data={data}
            onDone={(message) => {
              setSheet(null);
              if (!message) return;
              setToast(message);
              router.refresh();
            }}
          />
        </Sheet>
      )}
      {(sheet === "save" || sheet === "publish") && <SaveSheet data={data} publish={sheet === "publish"} caption={captionEdited ? caption : data.captionShown} onClose={() => setSheet(null)} />}
    </main>
  );
}

/** « Télécharger »: one image straight away; several, a sheet to keep them all at once. */
function SaveButton({ data, className, onMany }: { data: CarouselReviewData; className: string; onMany: () => void }) {
  const one = data.downloads.length === 1 ? data.downloads[0] : undefined;
  if (one) {
    return (
      <a href={one.url} download={one.name} className={className}>
        <DownloadIcon size={19} />
        Télécharger
      </a>
    );
  }
  return (
    <button type="button" onClick={onMany} disabled={!data.downloads.length} className={className} title={data.downloads.length ? undefined : "Les images finales se préparent"}>
      <DownloadIcon size={19} />
      Télécharger
    </button>
  );
}

/**
 * Her images on her phone: all at once into her photos where the phone can (its share sheet,
 * « Enregistrer les images »), else one by one. The files are fetched when the sheet opens, so
 * the share follows her tap at once (a phone refuses it after a wait).
 */
function SaveSheet({ data, publish = false, caption, onClose }: { data: CarouselReviewData; publish?: boolean; caption: string; onClose: () => void }) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(
      data.downloads.map(async (d) => {
        const response = await fetch(d.url);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        return new File([blob], d.name, { type: blob.type || (d.name.endsWith(".mp4") ? "video/mp4" : "image/jpeg") });
      }),
    ).then(
      (list) => live && setFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: list }) ? list : []),
      () => live && setFiles([]),
    );
    return () => {
      live = false;
    };
  }, [data.downloads]);
  // Instagram drops any text shared with files: her caption goes to the clipboard first.
  const copyCaption = () => {
    if (publish && caption.trim()) navigator.clipboard?.writeText(caption).catch(() => {});
  };
  const share = async () => {
    if (!files?.length) return;
    copyCaption();
    try {
      await navigator.share({ files });
      onClose();
    } catch (reason) {
      if (reason instanceof Error && reason.name === "AbortError") return;
      setFailed(true);
    }
  };
  return (
    <Sheet
      title={publish ? "Publie-le toi-même" : "Tes images"}
      hint={
        publish
          ? data.downloads.length > 1
            ? "Choisis Instagram : ta légende est copiée, colle-la au moment de publier. S’il ne garde qu’une photo : « Enregistrer les images », puis + › Publication et coche-les dans l’ordre."
            : "Choisis Instagram : ta légende est copiée, colle-la au moment de publier."
          : "Pour les publier toi-même, ou les garder."
      }
      onClose={onClose}
    >
      {files === null ? (
        <p className="text-[14px] font-semibold text-muted">Je prépare tes images…</p>
      ) : files.length > 0 && !failed ? (
        <button type="button" onClick={share} className="btn btn-primary w-full">
          {publish ? <ShareIcon size={18} /> : <DownloadIcon size={18} />}
          {publish ? "Partager sur Instagram" : `Enregistrer les ${files.length} images`}
        </button>
      ) : null}
      <ul className="grid grid-cols-5 gap-1.5">
        {data.downloads.map((d, i) => (
          <li key={d.url}>
            <a href={d.url} download={d.name} aria-label={`Télécharger l’image ${i + 1}`} className="relative block aspect-[4/5] overflow-hidden rounded-[8px] bg-soft">
              {d.name.endsWith(".mp4") ? (
                <span className="flex size-full items-center justify-center text-[12px] font-bold text-muted">Vidéo</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                <img src={d.url} alt="" className="size-full object-cover" />
              )}
              <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-white/90 text-ink">
                <DownloadIcon size={12} />
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] leading-snug text-muted">{files?.length && !failed ? "Ou touche une image pour l’enregistrer seule." : "Touche chaque image pour l’enregistrer."}</p>
      {publish && data.connect && (
        <a href="/api/instagram/connect" className="btn btn-secondary w-full">
          <InstagramIcon size={18} />
          Relier Instagram pour suivre tes résultats
        </a>
      )}
    </Sheet>
  );
}

/** Edith composing it, before its first images: where she is, and the page follows until they are there. */
function Making({ title, step, minutes }: { title: string; step: string; minutes: number }) {
  return (
    <main className="mx-auto flex h-dvh max-w-[480px] flex-col">
      <div className="flex items-center gap-3 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <a href={whatsappLink("")} aria-label="Retourner sur WhatsApp" className="flex size-10 items-center justify-center rounded-full bg-white/10">
          <ArrowLeftIcon size={19} />
        </a>
        <span className="min-w-0 flex-1 truncate text-center text-[14px] font-bold">{title}</span>
        <span className="size-10" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-white">
          <Mascot size={64} mood="thinking" />
        </span>
        <span className="text-[19px] font-extrabold">{MAKING[step] ?? "J’y travaille"}</span>
        <span className="text-[14px] leading-snug text-white/80">
          {minutes > 0 ? `En cours depuis ${minutes} min, ça prend en général 3 à 6 minutes.` : "Ça prend en général 3 à 6 minutes."} Tu peux fermer : je te préviens sur WhatsApp dès qu’il est prêt.
        </span>
      </div>
    </main>
  );
}
