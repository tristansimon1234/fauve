"use client";

import { DEFAULT_COVER_SECONDS, SIMONE_VOICES, voiceSamplePath, type EditPlan, type PostCover } from "@fauve/agent";
import { useEffect, useRef, useState, useTransition } from "react";
import { setMusic, setPublishByHand, setVoiceOff } from "@/app/(app)/publications/[id]/cover-actions";
import { saveEditPlan, updatePost } from "@/app/(app)/publications/[id]/actions";
import { setPlatforms } from "@/app/(app)/publications/[id]/platform-actions";
import { putVoice, redoReel, reschedule } from "@/app/(app)/publications/[id]/review-actions";
import { CoverPicker } from "@/components/montage/cover-picker";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CalendarIcon,
  CaptionIcon,
  ImageIcon,
  MicIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  ScissorsIcon,
  TypeIcon,
  ZapIcon,
} from "@/components/icons";
import { publicEnv } from "@/lib/public-env";
import type { ReviewData } from "@/lib/review";

// « Qu'est-ce qu'on change ? » under a Reel: what she changes herself (instant, free)
// and what Simone remakes (a new version in about two minutes), in her words, plus
// anything else said her way. One view at a time; nothing Simone remakes starts on a
// tap: each view says what will happen, takes a précision if she wants, and asks to confirm.

export type ChangeView = "menu" | "texts" | "caption" | "cover" | "date" | "shorter" | "punchier" | "music" | "voice";

const SAMPLES = `${publicEnv.supabaseUrl}/storage/v1/object/public/landing`;
const BIG = 1.25;

type Props = {
  data: ReviewData;
  view: ChangeView;
  onView: (view: ChangeView) => void;
  /** Something changed: a line to show her, and the page refreshed. */
  onDone: (message: string) => void;
  /** Shows the video at this second (where a text appears). */
  seek: (seconds: number) => void;
  /** « Autre chose » in her words: Simone's panel in the app, WhatsApp from its page. */
  ask: (text: string) => void;
  /** « Tout régler moi-même »: the full editor. */
  editorHref: string;
  cover: PostCover | null;
  shareToFeed: boolean;
};

export function ChangePanel(props: Props) {
  const { view, onView } = props;
  if (view === "menu") return <Menu {...props} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onView("menu")}
          aria-label="Tout ce qu’on peut changer"
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink hover:bg-soft"
        >
          <ArrowLeftIcon size={18} />
        </button>
        <h2 className="text-[18px] font-extrabold tracking-[-0.01em]">{TITLES[view]}</h2>
      </div>
      {view === "texts" && <TextsView {...props} />}
      {view === "caption" && <CaptionView {...props} />}
      {view === "cover" && <CoverView {...props} />}
      {view === "date" && <DateView {...props} />}
      {(view === "shorter" || view === "punchier") && <RedoView {...props} kind={view} />}
      {view === "music" && <MusicView {...props} />}
      {view === "voice" && <VoiceView {...props} />}
    </div>
  );
}

const TITLES: Record<Exclude<ChangeView, "menu">, string> = {
  texts: "Le texte à l’écran",
  caption: "La légende",
  cover: "La couverture",
  date: "Le jour et l’heure",
  shorter: "Plus court",
  punchier: "Plus rythmé",
  music: "La musique",
  voice: "Une voix off",
};

function Tile({ icon, label, onClick, tone, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; tone: "violet" | "peach"; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[56px] items-center gap-2.5 rounded-[16px] border border-line bg-white py-2 pr-3 pl-2 text-left transition-colors hover:border-lilac disabled:opacity-50"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone === "violet" ? "bg-violet-tint text-violet" : "bg-peach text-peach-ink"}`}
      >
        {icon}
      </span>
      <span className="text-[14.5px] leading-tight font-bold">{label}</span>
    </button>
  );
}

function Menu({ data, onView, ask, editorHref }: Props) {
  const [wish, setWish] = useState("");
  const busy = data.making !== null;
  const send = () => {
    const text = wish.trim();
    if (!text) return;
    setWish("");
    ask(text);
  };
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[19px] font-extrabold tracking-[-0.01em]">Qu’est-ce qu’on change ?</h2>
      <h3 className="text-[13.5px] font-bold text-muted">Change-le toi-même, c’est immédiat</h3>
      <div className="grid grid-cols-2 gap-2">
        <Tile tone="violet" icon={<TypeIcon size={18} />} label="Le texte à l’écran" onClick={() => onView("texts")} disabled={data.making !== null} />
        <Tile tone="violet" icon={<CaptionIcon size={18} />} label="La légende" onClick={() => onView("caption")} />
        <Tile tone="violet" icon={<ImageIcon size={18} />} label="La couverture" onClick={() => onView("cover")} disabled={!data.videoUrl} />
        <Tile tone="violet" icon={<CalendarIcon size={18} />} label="Le jour et l’heure" onClick={() => onView("date")} />
      </div>
      <h3 className="mt-1 text-[13.5px] font-bold text-muted">Simone refait la vidéo, 2 minutes environ</h3>
      <div className="grid grid-cols-2 gap-2">
        <Tile tone="peach" icon={<ScissorsIcon size={18} />} label="Plus court" onClick={() => onView("shorter")} disabled={busy} />
        <Tile tone="peach" icon={<ZapIcon size={18} />} label="Plus rythmé" onClick={() => onView("punchier")} disabled={busy} />
        <Tile tone="peach" icon={<MusicIcon size={18} />} label="La musique" onClick={() => onView("music")} disabled={busy} />
        <Tile tone="peach" icon={<MicIcon size={18} />} label="Une voix off" onClick={() => onView("voice")} disabled={busy} />
      </div>
      <form
        className="mt-1 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor={`wish-${data.postId}`} className="sr-only">
          Autre chose ? Dis-le à Simone
        </label>
        <input
          id={`wish-${data.postId}`}
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          placeholder="Autre chose ? Dis-le avec tes mots"
          className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-white px-4 text-[15px] outline-none focus:border-violet"
        />
        <button
          type="submit"
          aria-label="Envoyer à Simone"
          disabled={!wish.trim()}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet text-white disabled:bg-lilac"
        >
          <ArrowUpIcon size={20} />
        </button>
      </form>
      <a href={editorHref} className="self-center py-1.5 text-[13.5px] font-semibold text-muted underline underline-offset-3 hover:text-ink">
        Tout régler moi-même dans l’éditeur complet
      </a>
    </div>
  );
}

/** The button that applies a choice: always in sight at the bottom, even under a long list. */
function Done({ children, disabled, onClick, pending }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; pending?: boolean }) {
  return (
    <div className="sticky bottom-0 z-[1] mt-1 bg-white pt-2 shadow-[0_-14px_14px_-6px_#fff]">
      <button type="button" onClick={onClick} disabled={disabled || pending} className="btn btn-primary w-full disabled:opacity-60">
        {pending ? "Un instant…" : children}
      </button>
    </div>
  );
}

/** What she adds in her words, sent with the request (optional). */
function NoteField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-bold">
        {label} <span className="font-semibold text-muted">facultatif</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder={placeholder}
        className="resize-none rounded-[14px] border-[1.5px] border-line bg-white px-3.5 py-2.5 text-[15px] leading-snug outline-none focus:border-violet"
      />
    </label>
  );
}

const REDO_TEXT = {
  shorter: {
    what: "Simone garde l’accroche et la fin, et retire les passages les moins forts : environ un tiers de moins.",
    placeholder: "Ex. garde le plan du shampoing",
    button: "Refaire la vidéo, plus courte",
  },
  punchier: {
    what: "Des coupes plus rapprochées et plus d’énergie, calées sur la musique. Le sujet et la fin restent.",
    placeholder: "Ex. va plus vite au résultat",
    button: "Refaire la vidéo, plus rythmée",
  },
} as const;

/** « Plus court », « Plus rythmé »: what Simone will do, a précision if she wants, then her go. */
function RedoView({ data, onDone, kind }: Props & { kind: "shorter" | "punchier" }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const text = REDO_TEXT[kind];
  const go = () =>
    start(async () => {
      setError(null);
      const result = await redoReel(data.postId, kind, note);
      if (!result.ok) return setError(result.error);
      onDone("C’est parti : Simone refait la vidéo, environ 2 minutes. Tu peux fermer, je te préviens.");
    });
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] leading-snug text-muted">{text.what}</p>
      <NoteField label="Une précision ?" placeholder={text.placeholder} value={note} onChange={setNote} />
      <p className="text-[12.5px] leading-snug text-muted">Environ 2 minutes. Ta version actuelle reste, tu pourras y revenir.</p>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Done onClick={go} pending={pending} disabled={data.making !== null}>
        {text.button}
      </Done>
    </div>
  );
}

function TextsView({ data, onDone, seek }: Props) {
  const [texts, setTexts] = useState(() => data.plan.texts.map((t) => t.text));
  const [big, setBig] = useState(() => data.plan.texts.length > 0 && data.plan.texts.every((t) => (t.scale ?? 1) >= BIG));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wasBig = data.plan.texts.length > 0 && data.plan.texts.every((t) => (t.scale ?? 1) >= BIG);
  const changed = big !== wasBig || texts.some((t, i) => t.trim() !== data.plan.texts[i]?.text);
  const save = () =>
    start(async () => {
      setError(null);
      if (!changed) return onDone("");
      if (texts.some((t) => !t.trim())) return setError("Un texte est vide : écris quelque chose ou demande à Simone de le retirer.");
      const plan: EditPlan = {
        ...data.plan,
        texts: data.plan.texts.map((t, i) => ({
          ...t,
          text: texts[i]!.trim().slice(0, 120),
          ...(big !== wasBig ? { scale: big ? BIG : undefined } : {}),
        })),
      };
      const result = await saveEditPlan(data.postId, plan);
      if (!result.ok) return setError(result.error);
      onDone("Textes changés : la vidéo se met à jour, une minute environ.");
    });
  if (!data.plan.texts.length) {
    return <p className="text-[14px] leading-relaxed text-muted">Ce Reel n’a pas de texte à l’écran. Pour en ajouter un, dis-le à Simone.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13.5px] leading-snug text-muted">Touche un texte : la vidéo te montre où il apparaît.</p>
      {data.plan.texts.map((t, i) => (
        <label key={i} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-[12px] font-bold text-muted tabular-nums">{clock(t.from)}</span>
          <input
            value={texts[i] ?? ""}
            maxLength={120}
            onFocus={() => seek(t.from + 0.3)}
            onChange={(e) => setTexts((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
            aria-label={`Texte ${i + 1}`}
            className="h-11 min-w-0 flex-1 rounded-[14px] border-[1.5px] border-line bg-white px-3 text-[15px] font-semibold outline-none focus:border-violet"
          />
        </label>
      ))}
      <div className="mt-1 flex items-center gap-2">
        <span className="flex-1 text-[14px] font-bold">Taille</span>
        <div role="radiogroup" aria-label="Taille des textes" className="flex gap-1 rounded-full bg-chip p-1">
          {[
            { on: false, label: "Normale" },
            { on: true, label: "Plus grande" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={big === o.on}
              onClick={() => setBig(o.on)}
              className={`h-9 rounded-full px-3.5 text-[13.5px] font-bold ${big === o.on ? "bg-white shadow-sm" : "text-muted"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Done onClick={save} pending={pending}>
        C’est bon
      </Done>
    </div>
  );
}

const clock = (seconds: number) => `0:${String(Math.floor(seconds)).padStart(2, "0")}`;

function CaptionView({ data, onDone }: Props) {
  const [caption, setCaption] = useState(data.caption);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const save = () =>
    start(async () => {
      setError(null);
      if (caption.trim() === data.caption.trim()) return onDone("");
      const form = new FormData();
      form.set("intent", "save");
      form.set("caption", caption);
      const result = await updatePost(data.postId, { status: "idle" }, form);
      if (result.status === "error") return setError(result.message);
      onDone("Légende enregistrée.");
    });
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={`caption-${data.postId}`} className="text-[13.5px] leading-snug text-muted">
        Le texte sous ta vidéo. Écris par-dessus, ou dis à Simone ce que tu veux.
      </label>
      <textarea
        id={`caption-${data.postId}`}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={2200}
        rows={8}
        className="w-full resize-y rounded-[16px] border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-violet"
      />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            .writeText(caption)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
        className="self-start text-[13.5px] font-bold text-violet"
      >
        {copied ? "Légende copiée" : "Copier la légende"}
      </button>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Done onClick={save} pending={pending}>
        C’est bon
      </Done>
    </div>
  );
}

function CoverView({ data, onDone, cover, shareToFeed }: Props) {
  if (!data.videoUrl) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13.5px] leading-snug text-muted">L’image qu’on voit dans ta grille, avant d’ouvrir le Reel.</p>
      <CoverPicker postId={data.postId} videoUrl={data.videoUrl} initial={cover} defaultAt={DEFAULT_COVER_SECONDS} initialShareToFeed={shareToFeed} photos={[]} />
      <Done onClick={() => onDone("")}>C’est bon</Done>
    </div>
  );
}

/** A datetime-local value (« 2026-10-16T18:00 ») in the studio's time zone, from an ISO instant. */
function localValue(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** The ISO instant of a datetime-local value read in the studio's time zone. */
function fromLocalValue(value: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  // The same wall-clock time, corrected by the zone's offset at that moment.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const shown = new Date(localValue(new Date(guess).toISOString(), timeZone) + ":00Z").getTime();
  return new Date(guess - (shown - guess)).toISOString();
}

function DateView({ data, onDone }: Props) {
  const current = data.scheduledAt;
  const [chosen, setChosen] = useState<string | null>(current);
  const [other, setOther] = useState(() => (current ? localValue(current, data.timezone) : ""));
  const [platforms, setLocalPlatforms] = useState<string[]>(data.platforms.length ? data.platforms : ["instagram"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const options = [
    ...(current ? [{ iso: current, label: data.when?.full ?? "", hint: "le jour prévu" }] : []),
    ...data.slots.filter((s) => s.iso !== current),
  ].slice(0, 5);
  const toggle = (p: string) =>
    setLocalPlatforms((list) => (list.includes(p) ? (list.length > 1 ? list.filter((x) => x !== p) : list) : [...list, p]));
  const save = () =>
    start(async () => {
      setError(null);
      if (platforms.join() !== data.platforms.join()) {
        const ok = await setPlatforms(data.postId, platforms);
        if (!ok.ok) return setError("Les réseaux n’ont pas pu changer. Réessaie.");
      }
      if (chosen && chosen !== current) {
        const result = await reschedule(data.postId, chosen);
        if (!result.ok) return setError(result.error);
      }
      onDone(chosen && chosen !== current ? "C’est noté." : "");
    });
  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="Quand le publier" className="flex flex-col gap-1.5">
        {options.map((o) => {
          const on = chosen === o.iso;
          return (
            <button
              key={o.iso}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setChosen(o.iso);
                setOther(localValue(o.iso, data.timezone));
              }}
              className={`flex items-center gap-3 rounded-[16px] border-[1.5px] px-3.5 py-2.5 text-left ${on ? "border-violet bg-violet-tint" : "border-line bg-white hover:border-lilac"}`}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-extrabold">{o.label}</span>
                <span className="text-[12.5px] text-muted">{o.hint}</span>
              </span>
              <span className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-violet" : "border-lilac"}`}>
                {on && <span className="size-2.5 rounded-full bg-violet" />}
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1 text-[13px] font-bold text-muted">
        Ou un autre moment
        <input
          type="datetime-local"
          value={other}
          onChange={(e) => {
            setOther(e.target.value);
            setChosen(fromLocalValue(e.target.value, data.timezone));
          }}
          className="h-11 rounded-[14px] border-[1.5px] border-line bg-white px-3 text-[15px] font-semibold text-ink outline-none focus:border-violet"
        />
      </label>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[14px] font-bold">Où ?</span>
        {(["instagram", "tiktok"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={platforms.includes(p)}
            onClick={() => toggle(p)}
            className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-bold ${platforms.includes(p) ? "border-violet bg-violet-tint" : "border-line bg-white text-muted"}`}
          >
            {p === "instagram" ? "Instagram" : "TikTok"}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Done onClick={save} pending={pending}>
        C’est bon
      </Done>
    </div>
  );
}

type MusicOption = { id: string; title: string; hint: string; button: string; message: string; apply: () => Promise<{ ok: boolean }> };

/** The music: she picks, then confirms (the video is made again). */
function MusicView({ data, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = data.publishByHand ? "trend" : data.music?.on === false ? "none" : "simone";
  const [choice, setChoice] = useState(current);
  const hers = async () => {
    if (data.publishByHand) await setPublishByHand(data.postId, false);
  };
  const options: MusicOption[] = [
    ...(data.music
      ? [
          {
            id: "another",
            title: "Une autre musique",
            hint: "Simone en compose une nouvelle pour ce Reel.",
            button: "Composer une autre musique",
            message: "Simone compose une autre musique. La vidéo arrive dans deux minutes environ.",
            apply: async () => {
              await hers();
              return setMusic(data.postId, "another");
            },
          },
          {
            id: "simone",
            title: "La musique de Simone",
            hint: "Composée pour ce Reel, libre de droits.",
            button: "Remettre la musique de Simone",
            message: "La musique de Simone revient. La vidéo se refait, une minute environ.",
            apply: async () => {
              await hers();
              return data.music?.on ? { ok: true } : setMusic(data.postId, "on");
            },
          },
        ]
      : []),
    {
      id: "trend",
      title: "Un son tendance d’Instagram",
      hint: "Tu le choisis en publiant : à l’heure prévue, je t’envoie la vidéo et la légende sur WhatsApp.",
      button: "Je mettrai un son d’Instagram",
      message: "C’est noté : à l’heure prévue, je t’envoie la vidéo pour que tu ajoutes ton son.",
      apply: () => setPublishByHand(data.postId, true),
    },
    ...(data.music
      ? [
          {
            id: "none",
            title: "Sans musique",
            hint: "Juste le son de tes vidéos.",
            button: "Retirer la musique",
            message: "Sans musique : la vidéo se refait, une minute environ.",
            apply: async () => {
              await hers();
              return setMusic(data.postId, "off");
            },
          },
        ]
      : []),
  ];
  const picked = options.find((o) => o.id === choice);
  const changed = choice !== current;
  const apply = () =>
    start(async () => {
      if (!picked || !changed) return onDone("");
      setError(null);
      const result = await picked.apply();
      if (!result.ok) return setError("Ça n’a pas marché. Réessaie dans un instant.");
      onDone(picked.message);
    });
  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="La musique" className="flex flex-col gap-2">
        {options.map((o) => {
          const on = choice === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => setChoice(o.id)}
              className={`flex items-center gap-3 rounded-[16px] border-[1.5px] px-3.5 py-3 text-left disabled:opacity-60 ${on ? "border-violet bg-violet-tint" : "border-line bg-white hover:border-lilac"}`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-[15px] font-extrabold">
                  {o.title}
                  {o.id === current && <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-bold text-muted">Actuelle</span>}
                </span>
                <span className="text-[13px] leading-snug text-muted">{o.hint}</span>
              </span>
              <span className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-violet" : "border-lilac"}`}>
                {on && <span className="size-2.5 rounded-full bg-violet" />}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Done onClick={apply} pending={pending}>
        {changed && picked ? picked.button : "C’est bon"}
      </Done>
    </div>
  );
}

function VoiceView({ data, onDone }: Props) {
  const hers = data.voice?.who === "hers";
  const onReel = data.voice?.who === "simone" ? (SIMONE_VOICES.find((v) => v.name === data.voice?.name)?.id ?? null) : null;
  const [picked, setPicked] = useState<string | null>(onReel);
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  const listen = (id: string) => {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const sample = new Audio(`${SAMPLES}/${voiceSamplePath(id)}`);
    audio.current = sample;
    sample.onended = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    sample.play().catch(() => setPlaying(null));
  };
  const apply = () =>
    start(async () => {
      setError(null);
      audio.current?.pause();
      const words = note.trim();
      if (picked === onReel && !hers && !words) return onDone("");
      if (picked === null) {
        const result = await setVoiceOff(data.postId);
        return result.ok ? onDone("Sans voix : la vidéo se refait, une minute environ.") : setError("Ça n’a pas marché. Réessaie.");
      }
      const result = await putVoice(data.postId, picked, words);
      if (!result.ok) return setError(result.error);
      const name = SIMONE_VOICES.find((v) => v.id === picked)?.name ?? "";
      onDone(`C’est parti : ${name} enregistre la voix et Simone refait la vidéo, deux minutes environ.`);
    });
  const name = SIMONE_VOICES.find((v) => v.id === picked)?.name ?? "";
  const label =
    picked === null ? (onReel || hers ? "Retirer la voix" : "C’est bon") : picked === onReel && !note.trim() ? "C’est bon" : picked === onReel ? `Refaire la voix de ${name}` : `Mettre la voix de ${name}`;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13.5px] leading-snug text-muted">
        {hers ? "Ce Reel porte ta propre voix. Tu peux la retirer, ou la remplacer par une voix de Simone." : "Une voix raconte ton Reel, la musique passe dessous. Écoute et choisis."}
      </p>
      <div role="radiogroup" aria-label="La voix" className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
        {[{ id: null, name: "Sans voix", hint: "Juste la musique" }, ...SIMONE_VOICES.map((v) => ({ id: v.id as string | null, name: v.name, hint: `${v.hint.charAt(0).toUpperCase()}${v.hint.slice(1)}` }))].map((v) => {
          const on = picked === v.id;
          return (
            <div key={v.id ?? "none"} className={`flex items-center gap-1.5 rounded-[14px] border-[1.5px] py-1 pr-1 pl-3 ${on ? "border-violet bg-violet-tint" : "border-line bg-white"}`}>
              <button type="button" role="radio" aria-checked={on} onClick={() => setPicked(v.id)} className="flex min-w-0 flex-1 flex-col py-1.5 text-left">
                <span className="text-[14.5px] font-extrabold">{v.name}</span>
                <span className="truncate text-[12.5px] text-muted">{v.hint}</span>
              </button>
              {v.id && (
                <button
                  type="button"
                  onClick={() => listen(v.id!)}
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
      {picked !== null && (
        <NoteField label="Ce que la voix doit dire ?" placeholder="Ex. parle du cours offert pour une première venue" value={note} onChange={setNote} />
      )}
      <p className="text-[13px] leading-snug text-muted">Ou ta propre voix : envoie un vocal à Simone sur WhatsApp, elle le pose dessus.</p>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-danger">
          {error}
        </p>
      )}
      <Done onClick={apply} pending={pending}>
        {label}
      </Done>
    </div>
  );
}
