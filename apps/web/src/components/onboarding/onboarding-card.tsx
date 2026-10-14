"use client";

import { MOODBOARD_MAX_ITEMS, ONBOARDING_LABELS, ONBOARDING_STEPS, type OnboardingStep } from "@fauve/agent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { finishStep, onboardingView, saveRhythm, type OnboardingView } from "@/app/(app)/fauve/onboarding-actions";
import { saveMoodboard } from "@/app/(app)/style/actions";
import { CheckIcon, InstagramIcon, PlusIcon } from "@/components/icons";
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
  className = "",
}: {
  step: Step;
  timezone: string;
  /** Already loaded (the Fauve page); else the card loads it. */
  initial?: OnboardingView | null;
  /** Sends a message to Fauve (the website, « je n'ai pas de site »…). */
  onSend: (text: string) => void;
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
  const next = () => start(async () => void (await finishStep(step), await reload()));

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
      {step === "style" && view && <StyleStep studioId={view.studioId} view={view} onChange={reload} onNext={next} pending={pending} setError={setError} />}
      {step === "rhythm" && view && (
        <RhythmStep
          initial={view.rhythm}
          pending={pending}
          onSave={(posts, stories) =>
            start(async () => {
              const res = await saveRhythm(posts, stories);
              if (!res.ok) setError("Le rythme n’a pas pu être enregistré.");
              await reload();
            })
          }
        />
      )}
      {step === "connect" && view && <ConnectStep handle={view.instagram} onNext={next} pending={pending} />}
      {step === "first_post" && <FirstPostStep timezone={timezone} onLater={next} pending={pending} />}
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
  const valid = /\.[a-z]{2,}/i.test(url.trim());
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">Ton site me dit qui tu es, ce que tu proposes, tes couleurs et ton ton. Je le lis et je te résume ce que j’ai compris.</p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSend(`Voici mon site : ${url.trim()}`);
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoComplete="url"
          placeholder="monsite.fr"
          aria-label="Ton site"
          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-[15px] outline-none focus:border-violet"
        />
        <button type="submit" disabled={!valid || pending} className="btn btn-primary h-12 px-5 disabled:opacity-40">
          Lire mon site
        </button>
      </form>
      <button type="button" disabled={pending} onClick={() => onSend("Je n’ai pas de site internet.")} className="self-start text-[13px] font-semibold text-muted hover:text-ink">
        Je n’ai pas de site
      </button>
    </>
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
            <img src={view.brand.logoUrl} alt="Ton logo" className="h-10 max-w-[96px] object-contain" />
          )}
          {view.brand.colors.length > 0 && (
            <div className="flex -space-x-1.5" aria-label="Tes couleurs">
              {view.brand.colors.map((c) => (
                <span key={c} title={c} className="size-8 rounded-full border-2 border-white shadow-sm" style={{ background: c }} />
              ))}
            </div>
          )}
          {view.brand.fonts.length > 0 && <span className="text-[13px] text-muted">{view.brand.fonts.join(" · ")}</span>}
          <Link href="/style" className="ml-auto text-[13px] font-bold text-violet hover:underline">
            Corriger
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-bold">Ton moodboard</span>
        <p className="-mt-1 text-[13px] leading-snug text-muted">Des images de ce que tu aimes : des posts, des ambiances, des couleurs. Je m’en sers pour tous tes visuels.</p>
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
            <img key={i.path} src={i.url} alt="" className="aspect-square w-full rounded-[12px] object-cover" />
          ))}
          {room > 0 && (
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
        {view.moodboard.reading && <p className="rounded-[14px] bg-violet-tint px-3.5 py-2.5 text-[13px] leading-relaxed text-violet">{view.moodboard.reading}</p>}
        <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => (void add([...(e.target.files ?? [])]), (e.target.value = ""))} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending || busy !== null} onClick={onNext} className="btn btn-primary h-11 px-5 disabled:opacity-40">
          {items.length ? "C’est mon style, on continue" : "Continuer sans moodboard"}
        </button>
      </div>
    </>
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

function RhythmStep({ initial, pending, onSave }: { initial: { posts: number; stories: number }; pending: boolean; onSave: (posts: number, stories: number) => void }) {
  const [posts, setPosts] = useState(initial.posts);
  const [stories, setStories] = useState(initial.stories);
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">Combien de publications par semaine ? Je prépare ta semaine avec, et je te relance s’il manque quelque chose. Tu pourras le changer quand tu veux.</p>
      <div className="flex flex-col gap-2">
        <Counter label="Posts et Reels" value={posts} min={1} max={14} onChange={setPosts} />
        <Counter label="Stories" value={stories} min={0} max={21} onChange={setStories} />
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
          On continue
        </button>
      </>
    );
  }
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">Pour que je publie à l’heure prévue et que je lise tes résultats. Il faut un compte professionnel ou créateur ; rien ne part sans ta validation.</p>
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

function FirstPostStep({ timezone, onLater, pending }: { timezone: string; onLater: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="text-[14px] leading-relaxed text-muted">On commence par ce qui compte le plus : une inspiration, un post ou un Reel que tu aimerais refaire à ta façon. Je m’occupe du reste.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary h-11 px-5">
          <PlusIcon size={17} />
          Créer ma première publication
        </button>
        <button type="button" disabled={pending} onClick={onLater} className="text-[13px] font-semibold text-muted hover:text-ink">
          Plus tard
        </button>
      </div>
      {open && <NewPostSheet timezone={timezone} onClose={() => setOpen(false)} />}
    </>
  );
}
