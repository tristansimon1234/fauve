"use client";

import { instagramProfileHandle, INTRO_VIDEO, MOODBOARD_MAX_ITEMS, ONBOARDING_LABELS, ONBOARDING_STEPS, RHYTHM_PRESETS, sampleWeek, STYLE_PREVIEW_FRAME, type OnboardingStep } from "@fauve/agent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { DropCard } from "@/app/(app)/fauve/drop-card";
import { finishStep, lookAtSite, onboardingView, saveRhythm, type OnboardingView } from "@/app/(app)/fauve/onboarding-actions";
import { addCharterFont, saveLogo, saveMoodboard } from "@/app/(app)/style/actions";
import { LOGO_MAX_BYTES, LOGO_TYPES } from "@/app/(app)/style/style-options";
import { CheckIcon, InstagramIcon, PlusIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import { SlidePreview } from "@/components/montage/slide-preview";
import { NewPostSheet } from "@/components/new-post-sheet";
import { Orb } from "@/components/orb";
import { supabaseBrowser } from "@/lib/supabase/client";

// One step of getting started, as a card: on the Fauve page (the current one)
// and under Fauve's message in the chat (reply_with step_card). What can be done
// by hand is done here (rhythm, moodboard, Instagram, the first post); what
// needs Fauve (reading the website) goes to her as a message.

type Step = Exclude<OnboardingStep, "done">;
const STEPS = ONBOARDING_STEPS.filter((s): s is Step => s !== "done");

/** Resized to a light JPEG in the browser, like the Style page. */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.86));
}

export function OnboardingStepper({ step }: { step: OnboardingStep }) {
  const at = ONBOARDING_STEPS.indexOf(step);
  return (
    <ol className="flex w-full items-center gap-1.5" aria-label="Mise en route">
      {STEPS.map((s, i) => {
        const done = i < at;
        const on = i === at;
        return (
          <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={on ? "step" : undefined}>
            <span className={`h-1.5 rounded-full ${done ? "bg-violet" : on ? "fauve-pulse bg-violet/60" : "bg-line"}`} />
            <span className={`truncate text-[11px] sm:text-[12px] ${on ? "font-bold text-ink" : done ? "font-semibold text-violet" : "text-muted"}`}>
              {done && <CheckIcon size={10} className="mr-0.5 inline" />}
              {ONBOARDING_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingCard({
  step,
  timezone,
  initial,
  onSend,
  onFiles,
  className = "",
}: {
  step: Step;
  timezone: string;
  /** Already loaded (the Fauve page); else the card loads it. */
  initial?: OnboardingView | null;
  /** Sends a message to Fauve (the website, « je n'ai pas de site »…). */
  onSend: (text: string) => void;
  /** Her photos and videos, dropped on the card: they join the message she is about to send. */
  onFiles?: (files: FileList | File[]) => void;
  className?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<OnboardingView | null>(initial ?? null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The page follows too (the home shows the next step, the chat its stepper).
  const reload = () =>
    onboardingView()
      .then((v) => {
        setView(v);
        router.refresh();
      })
      .catch(() => {});
  useEffect(() => {
    if (!initial) onboardingView().then(setView).catch(() => {});
  }, [initial]);

  // A step already passed shows as done (an older card in the conversation).
  const passed = view ? ONBOARDING_STEPS.indexOf(view.step) > ONBOARDING_STEPS.indexOf(step) : false;
  // Moving on from the card also says so in the conversation: Edith answers and opens the next step.
  const next = (message: string) =>
    start(async () => {
      await finishStep(step);
      await reload();
      onSend(message);
    });

  const card = `flex w-full max-w-[560px] flex-col gap-4 rounded-[22px] border border-line bg-white p-5 text-left shadow-[0_8px_30px_rgba(28,21,48,0.06)] ${className}`;
  if (passed) {
    return (
      <div className={`${card} flex-row items-center gap-2 py-3.5`}>
        <span className="flex size-6 items-center justify-center rounded-full bg-violet text-white">
          <CheckIcon size={13} />
        </span>
        <span className="text-[14px] font-semibold">{ONBOARDING_LABELS[step]} : c’est fait</span>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-[13px] font-bold text-violet">{STEPS.indexOf(step) + 1}</span>
        <h3 className="text-[16px] font-bold">{ONBOARDING_LABELS[step]}</h3>
      </div>
      {step === "website" && <WebsiteStep onSend={onSend} pending={pending} />}
      {step === "style" && view && <StyleStep studioId={view.studioId} view={view} onChange={reload} onNext={() => next(view.moodboard.items.length ? "C’est mon style, on continue." : "On continue sans moodboard.")} pending={pending} setError={setError} />}
      {step === "rhythm" && view && (
        <RhythmStep
          initial={view.rhythm}
          offer={view.offer}
          pending={pending}
          onSave={(posts, stories) =>
            start(async () => {
              const res = await saveRhythm(posts, stories);
              if (!res.ok) return setError("Le rythme n’a pas pu être enregistré.");
              await reload();
              onSend(`Mon rythme : ${posts} post${posts > 1 ? "s" : ""} et ${stories} stor${stories > 1 ? "ies" : "y"} par semaine.`);
            })
          }
        />
      )}
      {step === "connect" && view && <ConnectStep handle={view.instagram} onNext={() => next(view.instagram ? "Mon Instagram est connecté." : "Je brancherai Instagram plus tard.")} pending={pending} />}
      {step === "first_post" && (
        <FirstPostStep
          timezone={timezone}
          sitePhotos={view?.moodboard.photosFrom ?? null}
          onFiles={onFiles}
          onSite={() => onSend("Je n’ai rien sous la main : pars des photos de mon site.")}
          onLater={() => next("Je ferai ma première publication plus tard.")}
          pending={pending}
        />
      )}
      {!view && step !== "website" && step !== "first_post" && <Orb size={28} />}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function WebsiteStep({ onSend, pending }: { onSend: (text: string) => void; pending: boolean }) {
  const [url, setUrl] = useState("");
  const given = url.trim();
  const instagram = instagramProfileHandle(given);
  const valid = Boolean(instagram) || /\.[a-z]{2,}/i.test(given);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* Who Edith is and what he does, in 30 seconds, read by his voice: the same video as the welcome on WhatsApp, played with its sound. */}
      <video
        src={INTRO_VIDEO.path}
        poster={INTRO_VIDEO.poster}
        playsInline
        controls
        preload="metadata"
        aria-label="Tout ce qu’il faut savoir sur Edith, en 30 secondes"
        className="aspect-[9/16] w-full max-w-[200px] shrink-0 self-center rounded-[18px] bg-soft object-cover sm:self-start"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[14px] leading-relaxed text-muted">Tout ce qu’il faut savoir sur moi est dans la vidéo. Pour commencer, ton site ou ton Instagram me disent qui tu es, ce que tu proposes et ton style : je les lis et je te résume ce que j’ai compris.</p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSend(instagram ? `Voici mon Instagram : ${given}` : `Voici mon site : ${given}`);
          }}
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoComplete="url"
            placeholder="monsite.fr ou @moninstagram"
            aria-label="Ton site ou ton Instagram"
            className="h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[15px] outline-none focus:border-violet"
          />
          <button type="submit" disabled={!valid || pending} className="btn btn-primary h-12 px-5 disabled:opacity-40">
            {instagram ? "Lire mon Instagram" : "Lire mon site"}
          </button>
        </form>
        <button type="button" disabled={pending} onClick={() => onSend("Je n’ai ni site ni Instagram.")} className="self-start text-[13px] font-semibold text-muted hover:text-ink">
          Ni site ni Instagram
        </button>
      </div>
    </div>
  );
}

function StyleStep({
  studioId,
  view,
  onChange,
  onNext,
  pending,
  setError,
}: {
  studioId: string;
  view: OnboardingView;
  onChange: () => void;
  onNext: () => void;
  pending: boolean;
  setError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState<"uploading" | "reading" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const items = view.moodboard.items;
  const room = MOODBOARD_MAX_ITEMS - items.length;
  // Edith reads her site's photos and look right after its step: the photos land here in a few seconds, her
  // style (its preview, « Tes Reels auront ce style ») a little later. She waits for both before moving on: the
  // preview came after she had already continued (Tristan: « il apparaît un peu tard… faire attendre le user »).
  // Nothing from her site after about 25 s (its photos land in a few): the reading never started (an answer WhatsApp
  // refused had lost it), so the card starts it, once, and waits for it a little longer.
  const [waited, setWaited] = useState(0);
  const [kicked, setKicked] = useState(false);
  const lookingAtSite = Boolean(view.website) && (!items.length || !view.siteRead) && waited < (kicked ? 45 : 30);
  useEffect(() => {
    if (!lookingAtSite) return;
    const timer = setTimeout(() => {
      if (waited === 6 && !items.length && !kicked) {
        setKicked(true);
        void lookAtSite().catch(() => {});
      }
      onChange();
      setWaited((n) => n + 1);
    }, 4000);
    return () => clearTimeout(timer);
  }, [lookingAtSite, waited, onChange, items.length, kicked]);

  const add = async (files: File[]) => {
    const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!picked.length) return;
    setError(null);
    setBusy("uploading");
    try {
      const paths: string[] = [];
      for (const file of picked) {
        const path = `${studioId}/brand/mood-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabaseBrowser().storage.from("media").upload(path, await toJpeg(file), { contentType: "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      }
      setBusy("reading");
      const res = await saveMoodboard([...items.map((i) => ({ path: i.path })), ...paths.map((path) => ({ path }))]);
      if (res.status === "error") setError(res.message);
      onChange();
    } catch {
      setError("L’ajout a échoué. Réessaie.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {(view.brand.colors.length > 0 || view.brand.fonts.length > 0 || view.brand.logoUrl) && (
        <div className="flex flex-wrap items-center gap-4 rounded-[16px] bg-soft p-3.5">
          {view.brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.brand.logoUrl} alt="Ton logo" className="h-10 max-w-[96px] object-contain [filter:drop-shadow(0_0_1px_rgba(28,21,48,0.55))_drop-shadow(0_1px_2px_rgba(28,21,48,0.25))]" />
          )}
          {view.brand.colors.length > 0 && (
            <div className="flex -space-x-1.5" aria-label="Tes couleurs">
              {view.brand.colors.map((c) => (
                <span key={c} title={c} className="size-8 rounded-full border-2 border-white shadow-sm" style={{ background: c }} />
              ))}
            </div>
          )}
          {view.fonts.length > 0 && <span className="text-[13px] text-muted">{view.fonts.map((f) => f.name).join(" · ")}</span>}
          <Link href="/style" className="ml-auto text-[13px] font-bold text-violet hover:underline">
            Corriger
          </Link>
        </div>
      )}
      {!view.preview && lookingAtSite && items.length > 0 && (
        <div className="fauve-fade flex items-center gap-4 rounded-[16px] bg-soft p-3.5">
          <span aria-hidden="true" className="aspect-[9/16] w-[118px] shrink-0 animate-pulse rounded-[12px] bg-line sm:w-[132px]" />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[14px] font-bold">Tes Reels auront ce style</span>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-violet">
              <Mascot size={24} mood="thinking" />
              Je le prépare avec tes titres, tes couleurs et ta lumière…
            </span>
          </div>
        </div>
      )}
      {view.preview && (
        <div className="flex items-start gap-4 rounded-[16px] bg-soft p-3.5">
          <div className="w-[118px] shrink-0 overflow-hidden rounded-[12px] shadow-sm sm:w-[132px]">
            <SlidePreview props={view.preview} frame={STYLE_PREVIEW_FRAME} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-[14px] font-bold">Tes Reels auront ce style</span>
            {view.direction && <p className="text-[13px] leading-relaxed text-muted">{view.direction}</p>}
            <span className="text-[12px] text-muted">
              {view.website ? "Tes titres, tes couleurs et ta lumière, comme sur ton site." : "Tes titres, tes couleurs et ta lumière, tirés de ton logo et de tes images."} Tu peux tout changer dans Style.
            </span>
          </div>
        </div>
      )}
      {view.fonts
        .filter((f) => f.twin && !f.own)
        .map((f) => (
          <CharterFontAsk key={f.name} studioId={studioId} font={f.name} twin={f.twin!} onSaved={onChange} setError={setError} />
        ))}
      {!view.brand.logoUrl && <LogoAsk studioId={studioId} hasSite={Boolean(view.website)} onSaved={onChange} setError={setError} />}
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-bold">Ton moodboard</span>
        <p className="-mt-1 text-[13px] leading-snug text-muted">
          {items.length && view.moodboard.photosFrom
            ? `J’ai pris ${view.moodboard.photosFrom === "instagram" ? "tes dernières photos Instagram" : "les photos de ton site"} pour commencer. Ajoute ou retire ce que tu veux : je m’en sers pour tous tes visuels.`
            : "Des images de ce que tu aimes : des posts, des ambiances, des couleurs. Je m’en sers pour tous tes visuels."}
        </p>
        {lookingAtSite && !items.length && (
          <p className="fauve-fade flex items-center gap-2 rounded-[14px] bg-violet-tint px-3.5 py-2.5 text-[13px] font-semibold text-violet">
            <Mascot size={24} mood="thinking" />
            Je regarde les photos et le style de ton site…
          </p>
        )}
        <div
          className="grid grid-cols-4 gap-2 sm:grid-cols-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void add([...e.dataTransfer.files]);
          }}
        >
          {items.map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i.path} src={i.url} alt="" className="fauve-enter aspect-square w-full rounded-[12px] object-cover" />
          ))}
          {/* The site's photos on their way: their places are already there. */}
          {lookingAtSite &&
            !items.length &&
            [0, 1, 2, 3].map((n) => <span key={n} aria-hidden="true" className="aspect-square w-full animate-pulse rounded-[12px] bg-line" style={{ animationDelay: `${n * 150}ms` }} />)}
          {room > 0 && !lookingAtSite && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[12px] border-[1.5px] border-dashed border-lilac bg-violet-tint text-violet disabled:opacity-60"
            >
              {busy ? <Orb size={22} /> : <PlusIcon size={20} />}
              <span className="text-[11px] font-bold">{busy === "reading" ? "Je regarde…" : busy ? "Envoi…" : "Ajouter"}</span>
            </button>
          )}
        </div>
        {!view.preview && view.direction && <p className="rounded-[14px] bg-violet-tint px-3.5 py-2.5 text-[13px] leading-relaxed text-violet">{view.direction}</p>}
        <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => (void add([...(e.target.files ?? [])]), (e.target.value = ""))} />
      </div>
      {/* No atmospheres to pick (Tristan: « je comprends pas trop l'utilité »): her style comes from what she has, or her words. */}
      {!items.length && !lookingAtSite && <p className="text-[13px] text-muted">Pas d’images sous la main ? Décris en bas, à ta façon, le style que tu veux.</p>}
      <div className="flex flex-wrap items-center gap-3">
        {lookingAtSite ? (
          // Not the moment to skip: what she is waiting for arrives in a few seconds.
          <span className="text-[13px] font-semibold text-muted">Encore quelques secondes…</span>
        ) : (
          <button type="button" disabled={pending || busy !== null} onClick={onNext} className="btn btn-primary h-11 px-5 disabled:opacity-40">
            {items.length ? "C’est mon style, on continue" : "Continuer sans moodboard"}
          </button>
        )}
      </div>
    </>
  );
}

/**
 * A font of her site that is not free: her videos use its look-alike until she adds the file,
 * kept under the font's own name so her Reels and photos use it at once.
 */
function CharterFontAsk({ studioId, font, twin, onSaved, setError }: { studioId: string; font: string; twin: string; onSaved: () => void; setError: (e: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["ttf", "otf", "woff", "woff2"].includes(ext)) return setError("Ta police : un fichier .ttf, .otf, .woff ou .woff2.");
    if (file.size > 8 * 1024 * 1024) return setError("Ce fichier dépasse 8 Mo.");
    setError(null);
    setBusy(true);
    try {
      const slug = `${font.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "police"}-${Date.now()}`;
      const path = `${studioId}/fonts/${slug}.${ext}`;
      const { error } = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type || `font/${ext}` });
      if (error) throw error;
      const res = await addCharterFont({ family: font, path });
      if (!res.ok) setError(res.message ?? "Ta police n’a pas pu être ajoutée.");
      onSaved();
    } catch {
      setError("Ta police n’a pas pu être ajoutée. Réessaie.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-white px-3.5 py-3">
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
        <b className="text-ink">{font}</b> n’est pas une police libre : tes vidéos utilisent <b className="text-ink">{twin}</b>, qui lui ressemble. Tu as son fichier ? Ajoute-le pour avoir la vraie.
      </span>
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="btn btn-secondary h-10 px-4 text-[13px] disabled:opacity-50">
        {busy ? <Orb size={18} /> : <PlusIcon size={16} />}
        {busy ? "Envoi…" : "Ajouter ma police"}
      </button>
      <input ref={ref} type="file" accept=".ttf,.otf,.woff,.woff2" className="sr-only" onChange={(e) => (e.target.files?.[0] && void upload(e.target.files[0]), (e.target.value = ""))} />
    </div>
  );
}

/** No logo on her site, or no site: she adds it here (it ends her Reels; with no site, her colours and fonts start from it). */
function LogoAsk({ studioId, hasSite, onSaved, setError }: { studioId: string; hasSite: boolean; onSaved: () => void; setError: (e: string | null) => void }) {
  const [busy, setBusy] = useState<"sending" | "reading" | false>(false);
  const ref = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    const ext = LOGO_TYPES[file.type];
    if (!ext) return setError("Ton logo : PNG, SVG, WebP ou JPEG.");
    if (file.size > LOGO_MAX_BYTES) return setError("Le logo dépasse 5 Mo.");
    setError(null);
    setBusy("sending");
    try {
      const path = `${studioId}/brand/logo-${Date.now()}.${ext}`;
      const { error } = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type });
      if (error) throw error;
      // Without a site, Edith reads her colours and fonts in it before the card shows them.
      if (!hasSite) setBusy("reading");
      const res = await saveLogo(path);
      if (res.status === "error") setError(res.message);
      onSaved();
    } catch {
      setError("Le logo n’a pas pu être ajouté. Réessaie.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[16px] border-[1.5px] border-dashed border-lilac bg-violet-tint px-3.5 py-3">
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-violet">
        {hasSite ? (
          <>
            <b>Ton logo</b> : je ne l’ai pas trouvé sur ton site. Ajoute-le, il signera tes Reels et tes photos.
          </>
        ) : (
          <>
            <b>Ton logo</b> : ajoute-le, j’en tire tes couleurs et tes polices, et il signera tes Reels.
          </>
        )}
      </span>
      <button type="button" disabled={Boolean(busy)} onClick={() => ref.current?.click()} className="btn btn-primary h-10 px-4 text-[13px] disabled:opacity-50">
        {busy ? <Orb size={18} /> : <PlusIcon size={16} />}
        {busy === "reading" ? "Je le regarde…" : busy ? "Envoi…" : "Ajouter mon logo"}
      </button>
      <input ref={ref} type="file" accept={Object.keys(LOGO_TYPES).join(",")} className="sr-only" onChange={(e) => (e.target.files?.[0] && void upload(e.target.files[0]), (e.target.value = ""))} />
    </div>
  );
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-soft px-4 py-3">
      <span className="text-[14px] font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${label} : moins`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex size-9 items-center justify-center rounded-full bg-white text-[18px] font-bold disabled:opacity-30">
          −
        </button>
        <span className="w-6 text-center text-[18px] font-extrabold tabular-nums">{value}</span>
        <button type="button" aria-label={`${label} : plus`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex size-9 items-center justify-center rounded-full bg-white text-[18px] font-bold disabled:opacity-30">
          +
        </button>
      </div>
    </div>
  );
}

function RhythmStep({
  initial,
  offer,
  pending,
  onSave,
}: {
  initial: { posts: number; stories: number };
  offer: OnboardingView["offer"];
  pending: boolean;
  onSave: (posts: number, stories: number) => void;
}) {
  const [posts, setPosts] = useState(initial.posts);
  const [stories, setStories] = useState(initial.stories);
  // About 4.3 weeks a month.
  const perMonth = Math.round(posts * 4.3);
  const week = sampleWeek(posts);
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">
        Combien de publications par semaine ? Mieux vaut 2 ou 3 publications soignées, chaque semaine, que 5 faites à la va-vite : ce qui fait venir des clients, c’est d’être là
        régulièrement avec des posts qui donnent envie. Je prépare ta semaine avec, et tu pourras le changer quand tu veux.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rythmes proposés">
        {RHYTHM_PRESETS.map((p) => {
          const on = p.posts === posts && p.stories === stories;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => (setPosts(p.posts), setStories(p.stories))}
              className={`flex flex-col items-start rounded-[14px] border-[1.5px] px-3.5 py-2 text-left ${on ? "border-violet bg-violet-tint" : "border-line bg-white hover:border-lilac"}`}
            >
              <span className="text-[13px] font-bold">
                {p.label}
                {p.advised && <span className="ml-1.5 rounded-full bg-violet px-1.5 py-0.5 text-[10px] font-extrabold text-white">conseillé</span>}
              </span>
              <span className="text-[12px] text-muted">
                {p.posts} posts · {p.stories} stories
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Counter label="Posts et Reels" value={posts} min={1} max={14} onChange={setPosts} />
        <Counter label="Stories" value={stories} min={0} max={21} onChange={setStories} />
      </div>
      <div className="flex flex-col gap-1.5 rounded-[16px] bg-soft px-4 py-3">
        <span className="text-xs font-extrabold tracking-[.06em] text-muted">UNE SEMAINE TYPE</span>
        <ul className="flex flex-col gap-1">
          {week.map((d) => (
            <li key={d.day} className="text-[13px]">
              <b className="capitalize">{d.day}</b> · {d.idea}
            </li>
          ))}
          {stories > 0 && (
            <li className="text-[13px]">
              <b>Stories</b> · les coulisses du jour, une question, les places ou créneaux libres : elles parlent à ceux qui te suivent déjà, ceux qui réservent.
            </li>
          )}
        </ul>
        <span className="text-[12px] leading-snug text-muted">
          Environ {perMonth} publications par mois. Avec {offer.label} ({offer.credits} crédits), de quoi faire {offer.reels} Reels soignés par mois ; les photos avec leurs textes ne coûtent
          rien.
          {posts > offer.postsPerWeek + 1 && " À ce rythme, alterne les Reels avec des carrousels pour garder le même soin sur chacun."}
        </span>
      </div>
      <button type="button" disabled={pending} onClick={() => onSave(posts, stories)} className="btn btn-primary h-11 self-start px-5 disabled:opacity-40">
        C’est mon rythme
      </button>
    </>
  );
}

function ConnectStep({ handle, onNext, pending }: { handle: string | null; onNext: () => void; pending: boolean }) {
  if (handle) {
    return (
      <>
        <p className="text-[14px] text-muted">
          Ton compte <strong className="text-ink">@{handle}</strong> est connecté.
        </p>
        <button type="button" disabled={pending} onClick={onNext} className="btn btn-primary h-11 self-start px-5">
          C’est tout bon
        </button>
      </>
    );
  }
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">Dernière étape : branche ton Instagram pour que je publie ta publication d’un mot et que je lise tes résultats. Il faut un compte professionnel ou créateur ; rien ne part sans ta validation.</p>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/api/instagram/connect" className="btn btn-primary h-11 px-5">
          <InstagramIcon size={18} />
          Connecter Instagram
        </a>
        <button type="button" disabled={pending} onClick={onNext} className="text-[13px] font-semibold text-muted hover:text-ink">
          Plus tard
        </button>
      </div>
    </>
  );
}

function FirstPostStep({
  timezone,
  sitePhotos,
  onFiles,
  onSite,
  onLater,
  pending,
}: {
  timezone: string;
  /** Her site's photos, or her Instagram's, are in her library. */
  sitePhotos: "site" | "instagram" | null;
  onFiles?: (files: FileList | File[]) => void;
  onSite: () => void;
  onLater: () => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  // One thing to do: drop her photos and videos. Edith's message says why; the rest are small links.
  return (
    <>
      {onFiles ? (
        <DropCard kind="any" onFiles={onFiles} wide />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary h-11 self-start px-5">
          <PlusIcon size={17} />
          Créer ma première publication
        </button>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-muted">
        {onFiles ? (
          <button type="button" onClick={() => setOpen(true)} className="hover:text-ink">
            Choisir dans ma médiathèque
          </button>
        ) : null}
        {sitePhotos ? (
          <button type="button" disabled={pending} onClick={onSite} className="hover:text-ink">
            {sitePhotos === "instagram" ? "Partir de mes photos Instagram" : "Partir des photos de mon site"}
          </button>
        ) : null}
        <button type="button" disabled={pending} onClick={onLater} className="hover:text-ink">
          Plus tard
        </button>
      </div>
      {open && <NewPostSheet timezone={timezone} onClose={() => setOpen(false)} />}
    </>
  );
}
